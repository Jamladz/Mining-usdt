import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './src/db/index.js';
import { users, miningClaims, taskCompletions, withdrawals, referrals } from './src/db/schema.js';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { REFERRAL_USDT_REWARD_UNITS, REFERRAL_MINING_BONUS_UNITS, USDT_SCALE } from './src/config/referral.js';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'mock_token';
const BASE_MINING_RATE = 1000; // 0.10 USDT per day base
const MAX_MINING_RATE = 100000; // 10.00 USDT per day max
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_WITHDRAWAL = 30000; // 3 USDT

// Utility: Validate Telegram initData
function validateInitData(initData: string): any {
  // In development, allow bypass if token is mock_token
  if (process.env.NODE_ENV !== 'production' && BOT_TOKEN === 'mock_token') {
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (userStr) return JSON.parse(userStr);
      return { id: 12345, username: 'dev_user', first_name: 'Dev' };
    } catch {
      return { id: 12345, username: 'dev_user', first_name: 'Dev' };
    }
  }

  // Fail-fast in production if token is mock_token or empty
  if (!BOT_TOKEN || BOT_TOKEN === 'mock_token') {
    throw new Error('Telegram Bot Token (TELEGRAM_BOT_TOKEN) is not configured in production mode!');
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hash !== expectedHash) {
    throw new Error('Invalid signature');
  }

  const userStr = urlParams.get('user');
  if (!userStr) throw new Error('No user data');
  return JSON.parse(userStr);
}

// Middleware to extract and validate user
const requireUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const initData = req.headers['authorization'] || '';
  try {
    const tgUser = validateInitData(initData);
    if (!tgUser || !tgUser.id) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).user = tgUser;
    
    // Extract start_param directly from raw initData query-string as fallback
    let startParamFallback = '';
    try {
      const urlParams = new URLSearchParams(initData);
      startParamFallback = urlParams.get('start_param') || '';
    } catch (e) {
      console.warn('Failed parsing start_param from authorization header:', e);
    }
    
    (req as any).startParamFallback = startParamFallback;
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

async function getFormattedUser(userId: string) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const recentTasks = await db.select().from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        gt(taskCompletions.completedAt, now - ONE_DAY)
      )
    ).all();

  const completedTasksData = recentTasks.map(t => ({
    taskId: t.taskId,
    completedAt: t.completedAt
  }));

  return {
    ...user,
    completedTasks: JSON.stringify(completedTasksData)
  };
}

// API ROUTES

// AUTHENTICATION & ATOMIC REFERRAL PROCESSING
app.post('/api/auth', requireUser, async (req: any, res: any) => {
  const tgUser = req.user;
  const userId = tgUser.id.toString();
  
  let user = await db.select().from(users).where(eq(users.id, userId)).get();
  let isNewUserFlag = false;

  // Extract and sanitize referrer ID
  const rawRef = req.body.start_param || req.startParamFallback || '';
  let referrerId: string | null = null;
  if (rawRef) {
    referrerId = rawRef.toString()
      .replace(/^ref_tg_/, '')
      .replace(/^ref_/, '')
      .replace(/^startapp_/, '')
      .trim();
  }

  // 1. Register user if new
  if (!user) {
    isNewUserFlag = true;
    try {
      user = await db.insert(users).values({
        id: userId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        photoUrl: tgUser.photo_url || '',
        referralCode: userId,
        balance: 0,
        totalEarned: 0,
        miningRate: BASE_MINING_RATE,
        referralsCount: 0,
        referralEarnings: 0,
        createdAt: Date.now()
      }).returning().get();
      console.log(`[AUTH] New user created: ${userId}`);
    } catch (err) {
      console.warn(`[AUTH] Concurrent registration attempt for ${userId}`);
      user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(500).json({ error: 'Database error' });
    }
  }

  // 2. Atomic Referral Processing
  // Rules:
  // - referrerId must exist and not be empty
  // - No Self Referral (referrerId !== userId)
  // - First valid referrer wins (user.referredBy must be empty/null)
  if (referrerId && referrerId !== userId && (!user.referredBy || user.referredBy.trim() === '')) {
    if (/^[0-9]{5,15}$/.test(referrerId)) {
      try {
        await db.transaction(async (tx) => {
          // Re-verify current state inside transaction
          const currentUserState = await tx.select().from(users).where(eq(users.id, userId)).get();
          if (!currentUserState || (currentUserState.referredBy && currentUserState.referredBy.trim() !== '')) {
            console.log(`[REFERRAL ALREADY PROCESSED] User ${userId} already has referrer.`);
            return;
          }

          const referrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
          if (!referrer) {
            console.log(`[REFERRAL INVALID] Referrer ${referrerId} does not exist.`);
            return;
          }

          // Check if referral record already exists
          const existingRef = await tx.select().from(referrals).where(eq(referrals.referredUserId, userId)).get();
          if (existingRef) {
            console.log(`[REFERRAL ALREADY RECORDED] Referral record already exists for ${userId}.`);
            return;
          }

          // Execute Referral Atomic Transaction
          // A) Record successful referral
          await tx.insert(referrals).values({
            referrerId,
            referredUserId: userId,
            rewardUSDT: REFERRAL_USDT_REWARD_UNITS, // 1000 = 0.10 USDT
            miningBonus: REFERRAL_MINING_BONUS_UNITS, // 100 = 0.01 Mining Rate
            status: 'completed',
            createdAt: Date.now()
          });

          // B) Update Referred User (B): set referredBy = referrerId
          await tx.update(users).set({
            referredBy: referrerId,
            updatedAt: Date.now()
          }).where(eq(users.id, userId));

          // C) Update Referrer (A): +0.1 USDT balance, +0.01 miningRate, +1 referralsCount, +0.1 USDT referralEarnings
          await tx.update(users).set({
            balance: referrer.balance + REFERRAL_USDT_REWARD_UNITS,
            totalEarned: referrer.totalEarned + REFERRAL_USDT_REWARD_UNITS,
            miningRate: Math.min(referrer.miningRate + REFERRAL_MINING_BONUS_UNITS, MAX_MINING_RATE),
            referralsCount: referrer.referralsCount + 1,
            referralEarnings: referrer.referralEarnings + REFERRAL_USDT_REWARD_UNITS,
            updatedAt: Date.now()
          }).where(eq(users.id, referrerId));

          console.log(`[REFERRAL SUCCESS] ${referrerId} referred ${userId}. Referrer rewarded: +0.1 USDT, +0.01 Mining Rate.`);
        });

        // Refresh user after transaction
        user = await db.select().from(users).where(eq(users.id, userId)).get();
      } catch (err: any) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          console.log(`[REFERRAL IDEMPOTENCY] Unique constraint triggered for user ${userId}.`);
        } else {
          console.error('[REFERRAL TRANSACTION ERROR]', err);
        }
      }
    }
  }

  const formattedUser = await getFormattedUser(userId);

  res.json({ 
    user: formattedUser, 
    referralsCount: user!.referralsCount, 
    referralEarnings: user!.referralEarnings,
    isNewUser: isNewUserFlag
  });
});

app.post('/api/welcome/claim', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.claimedWelcome && user.claimedWelcome > 0) {
    return res.status(400).json({ error: 'Welcome bonus already claimed' });
  }

  const WELCOME_BONUS_UNITS = 5000; // 0.50 USDT (10000 = 1.00 USDT)

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance + WELCOME_BONUS_UNITS,
      totalEarned: user.totalEarned + WELCOME_BONUS_UNITS,
      claimedWelcome: 1,
      updatedAt: Date.now()
    }).where(eq(users.id, userId));
  });

  const updatedUser = await getFormattedUser(userId);
  res.json({ success: true, user: updatedUser });
});

app.post('/api/mine', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const now = Date.now();
  if (user.lastClaimAt && now - user.lastClaimAt < CLAIM_COOLDOWN_MS) {
    return res.status(400).json({ error: 'Cooldown active', nextClaimAt: user.lastClaimAt + CLAIM_COOLDOWN_MS });
  }

  const reward = user.miningRate;

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance + reward,
      totalEarned: user.totalEarned + reward,
      lastClaimAt: now,
    }).where(eq(users.id, userId));

    await tx.insert(miningClaims).values({
      userId,
      amount: reward,
      claimedAt: now,
      nextClaimAt: now + CLAIM_COOLDOWN_MS,
    });
  });

  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
  res.json({ success: true, balance: updatedUser.balance, lastClaimAt: updatedUser.lastClaimAt });
});

app.get('/api/mine/history', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  try {
    const history = await db.select()
      .from(miningClaims)
      .where(eq(miningClaims.userId, userId))
      .orderBy(desc(miningClaims.claimedAt))
      .limit(30)
      .all();
    res.json({ history });
  } catch (err) {
    console.error('[MINING HISTORY ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch mining history' });
  }
});

app.post('/api/tasks/complete', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { taskId, provider } = req.body;
  
  if (!taskId || !provider) return res.status(400).json({ error: 'Missing task details' });

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const existing = await db.select().from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId), 
        eq(taskCompletions.taskId, taskId),
        taskId === 'sys_add_home'
          ? sql`1=1`
          : gt(taskCompletions.completedAt, now - ONE_DAY)
      )
    )
    .get();

  if (existing) {
    return res.status(400).json({ error: 'Task already completed recently' });
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  let boostAmount = 100; // +0.01 USDT
  if (taskId === 'sys_add_home') {
    boostAmount = 3000; // +0.30 USDT
  } else if (taskId.startsWith('adsgram_reward')) {
    boostAmount = 200; // +0.02 USDT
  } else if (taskId === 'adsgram_task') {
    boostAmount = 300; // +0.03 USDT
  } else if (taskId.startsWith('adsgram_interstitial')) {
    boostAmount = 100; // +0.01 USDT
  } else if (taskId === 'monetag_rewarded_interstitial') {
    boostAmount = 300; // +0.03 USDT
  } else if (taskId === 'monetag_rewarded_popup') {
    boostAmount = 200; // +0.02 USDT
  } else if (taskId === 'monetag_inapp_interstitial') {
    boostAmount = 100; // +0.01 USDT
  }
  
  const newRate = Math.min(user.miningRate + boostAmount, MAX_MINING_RATE);

  await db.transaction(async (tx) => {
    await tx.insert(taskCompletions).values({
      userId,
      taskId,
      provider,
      reward: boostAmount,
      completedAt: Date.now(),
    });

    await tx.update(users).set({ miningRate: newRate }).where(eq(users.id, userId));
  });

  res.json({ success: true, newRate });
});

app.get('/api/tasks', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const completed = await db.select().from(taskCompletions).where(eq(taskCompletions.userId, userId)).all();
  res.json({ completedTasks: completed.map(c => c.taskId) });
});

app.post('/api/withdraw', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { amount, walletAddress } = req.body;
  
  if (!amount || !walletAddress) return res.status(400).json({ error: 'Missing withdrawal details' });
  if (amount < MIN_WITHDRAWAL) return res.status(400).json({ error: 'Minimum withdrawal is 3 USDT' });

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.referralsCount < 3) {
    return res.status(400).json({ error: 'You must refer at least 3 active friends to withdraw funds.' });
  }

  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance - amount,
      totalWithdrawn: user.totalWithdrawn + amount
    }).where(eq(users.id, userId));

    await tx.insert(withdrawals).values({
      userId,
      amount,
      walletAddress,
      status: 'pending',
      createdAt: Date.now()
    });
  });

  res.json({ success: true });
});

app.get('/api/withdrawals', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const history = await db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).all();
  res.json({ history });
});

app.get('/api/referrals', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const friends = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt)).all();
  
  const friendDetails = await Promise.all(friends.map(async (f) => {
    const friendUser = await db.select().from(users).where(eq(users.id, f.referredUserId)).get();
    return {
      id: f.id,
      referrerId: f.referrerId,
      referredUserId: f.referredUserId,
      referredName: friendUser?.firstName || friendUser?.username || 'User',
      rewardUSDT: f.rewardUSDT,
      miningBonus: f.miningBonus,
      status: f.status || 'completed',
      createdAt: f.createdAt
    };
  }));

  res.json({ referrals: friendDetails });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
