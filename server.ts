import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './src/db/index.js';
import { users, miningClaims, taskCompletions, withdrawals, referrals } from './src/db/schema.js';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'mock_token';
const USDT_SCALE = 10000; // 1 USDT = 10000 units
const BASE_MINING_RATE = 1000; // 0.10 USDT per day
const MAX_MINING_RATE = 100000; // 0.15 USDT per day
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_WITHDRAWAL = 30000; // 3 USDT

// Referral System Constants
const WELCOME_REFERRAL_REWARD = 7000; // 0.7 USDT gift for the new user
const REFERRER_REWARD = 1000;       // 0.1 USDT reward for the referrer
const REFERRER_RATE_BOOST = 200;    // +0.02 Mining Rate boost for the referrer

const MILESTONES = [
  { id: 'm1', target: 3, rewardUsdt: 3000, rewardRate: 500 }, // 0.3 USDT, +0.05 Rate
  { id: 'm2', target: 10, rewardUsdt: 10000, rewardRate: 1000 }, // 1.0 USDT, +0.10 Rate
  { id: 'm3', target: 25, rewardUsdt: 25000, rewardRate: 2000 }, // 2.5 USDT, +0.20 Rate
  { id: 'm4', target: 50, rewardUsdt: 50000, rewardRate: 5000 }, // 5.0 USDT, +0.50 Rate
  { id: 'm5', target: 100, rewardUsdt: 100000, rewardRate: 10000 }, // 10.0 USDT, +1.0 Rate
];

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
    console.log(`[AUTH LOGGER] User ID: ${tgUser.id}, Username: ${tgUser.username || 'unknown'}, Header start_param: "${startParamFallback}"`);
    
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
app.post('/api/auth', requireUser, async (req: any, res: any) => {
  const tgUser = req.user;
  const userId = tgUser.id.toString();
  
  let user = await db.select().from(users).where(eq(users.id, userId)).get();
  let isNewUserFlag = false;

  // 1. & 2. & 3. Extract and sanitize referrer ID
  const rawRef = req.body.start_param || req.startParamFallback || '';
  let referrerId: string | null = null;
  if (rawRef) {
    referrerId = rawRef.toString()
      .replace(/^ref_tg_/, '')
      .replace(/^ref_/, '')
      .replace(/^startapp_/, '')
      .trim();
  }

  if (!user) {
    isNewUserFlag = true;
    
    // Create new user record first (Minimal)
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
        claimedMilestones: '[]',
        referralsCount: 0,
        earnedReferralCoins: 0,
        createdAt: Date.now()
      }).returning().get();
      console.log(`[AUTH] New user registered: ${userId}`);
    } catch (err) {
      console.warn(`[AUTH] Concurrent registration attempt for ${userId}`);
      user = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!user) return res.status(500).json({ error: 'Database error' });
    }
  }

  // 4. - 9. Referral Logic (Idempotent & Atomic)
  if (referrerId && referrerId !== userId && (!user.referredBy || user.referredBy.trim() === '')) {
    // 4. Validate referrer exists
    if (/^[0-9]{5,15}$/.test(referrerId)) {
      try {
        await db.transaction(async (tx) => {
          const referrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
          
          if (referrer) {
            // Check for existing global referral for this user (Unique constraint fallback)
            const globalRef = await tx.select().from(referrals).where(eq(referrals.referredUserId, userId)).get();
            
            if (!globalRef) {
              console.log(`[REFERRAL] Processing: ${referrerId} -> ${userId}`);
              
              // 9. Execute referral transaction
              // Record relationship
              await tx.insert(referrals).values({
                referrerId,
                referredUserId: userId,
                rewardStatus: 'paid',
                createdAt: Date.now()
              });

              // Update Referrer: +1 count, +cash reward, +rate boost
              await tx.update(users).set({
                miningRate: Math.min(referrer.miningRate + REFERRER_RATE_BOOST, MAX_MINING_RATE),
                balance: referrer.balance + REFERRER_REWARD,
                totalEarned: referrer.totalEarned + REFERRER_REWARD,
                referralsCount: referrer.referralsCount + 1,
                earnedReferralCoins: referrer.earnedReferralCoins + REFERRER_REWARD
              }).where(eq(users.id, referrerId));

              // Update Referred User: +welcome reward, set referredBy
              let claimedArr: string[] = [];
              try { claimedArr = JSON.parse(user!.claimedMilestones || '[]'); } catch (e) {}
              if (!claimedArr.includes('welcome_claimed')) claimedArr.push('welcome_claimed');

              await tx.update(users).set({
                referredBy: referrerId,
                balance: user!.balance + WELCOME_REFERRAL_REWARD,
                totalEarned: user!.totalEarned + WELCOME_REFERRAL_REWARD,
                claimedMilestones: JSON.stringify(claimedArr)
              }).where(eq(users.id, userId));

              console.log(`[REFERRAL SUCCESS] ${referrerId} referred ${userId}. Rewards distributed.`);
            }
          }
        });
        // Refresh user object after transaction
        user = await db.select().from(users).where(eq(users.id, userId)).get();
      } catch (err: any) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          console.log(`[REFERRAL] Idempotency check: ${userId} already referred.`);
        } else {
          console.error('[REFERRAL ERROR]', err);
        }
      }
    }
  }

  const formattedUser = await getFormattedUser(userId);

  res.json({ 
    user: formattedUser, 
    referralsCount: user!.referralsCount, 
    referralBonusEarned: user!.earnedReferralCoins,
    isNewUser: isNewUserFlag
  });
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

  // Moderate boost: +10% of base rate
  let boostAmount = 100; // +0.01 USDT
  if (taskId === 'sys_add_home') {
    boostAmount = 3000; // +0.30 USDT (Permanent)
  } else if (taskId === 'adsgram_reward') {
    boostAmount = 200; // +0.02 USDT
  } else if (taskId === 'adsgram_task') {
    boostAmount = 300; // +0.03 USDT
  } else if (taskId.startsWith('adsgram_interstitial_')) {
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
  const { amount, walletAddress } = req.body; // amount is in USDT_SCALE
  
  if (!amount || !walletAddress) return res.status(400).json({ error: 'Missing withdrawal details' });
  if (amount < MIN_WITHDRAWAL) return res.status(400).json({ error: 'Minimum withdrawal is 3 USDT' });

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Enforce 3 referrals limit using the source of truth column
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
  const friends = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).all();
  
  // Get usernames for friends
  const friendDetails = await Promise.all(friends.map(async (f) => {
    const friendUser = await db.select().from(users).where(eq(users.id, f.referredUserId)).get();
    return {
      id: f.referredUserId,
      username: friendUser?.username || 'Unknown',
      createdAt: f.createdAt
    };
  }));

  res.json({ friends: friendDetails });
});

app.get('/api/referrals/leaderboard', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  try {
    const topReferrers = await db.select()
      .from(users)
      .where(gt(users.referralsCount, 0))
      .orderBy(desc(users.referralsCount))
      .limit(20)
      .all();

    const leaderboard = topReferrers.map((u) => ({
      id: u.id,
      username: u.username || 'Anonymous',
      firstName: u.firstName || 'User',
      photoUrl: u.photoUrl || '',
      referralsCount: u.referralsCount,
      isCurrentUser: u.id === userId
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('[LEADERBOARD ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Milestones handled at the top of the file

app.post('/api/referrals/milestone', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { milestoneId } = req.body;
  
  const milestone = MILESTONES.find(m => m.id === milestoneId);
  if (!milestone) return res.status(400).json({ error: 'Invalid milestone' });

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  let claimedMilestones: string[] = [];
  try {
    claimedMilestones = JSON.parse(user.claimedMilestones || '[]');
  } catch (e) {}

  if (claimedMilestones.includes(milestoneId)) {
    return res.status(400).json({ error: 'Milestone already claimed' });
  }

  if (user.referralsCount < milestone.target) {
    return res.status(400).json({ error: 'Not enough referrals' });
  }

  claimedMilestones.push(milestoneId);
  
  const newRate = Math.min(user.miningRate + milestone.rewardRate, MAX_MINING_RATE);
  
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance + milestone.rewardUsdt,
      totalEarned: user.totalEarned + milestone.rewardUsdt,
      miningRate: newRate,
      claimedMilestones: JSON.stringify(claimedMilestones)
    }).where(eq(users.id, userId));
  });

  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
  res.json({ success: true, user: updatedUser });
});


app.post('/api/referrals/claim-welcome', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.referredBy) {
    return res.status(400).json({ error: 'No referral associated with this account' });
  }

  let claimedMilestones: string[] = [];
  try {
    claimedMilestones = JSON.parse(user.claimedMilestones || '[]');
  } catch (e) {}

  if (claimedMilestones.includes('welcome_claimed')) {
    return res.status(400).json({ error: 'Welcome bonus already claimed' });
  }

  claimedMilestones.push('welcome_claimed');
  const WELCOME_BONUS = 7000; // 0.7 USDT

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance + WELCOME_BONUS,
      totalEarned: user.totalEarned + WELCOME_BONUS,
      claimedMilestones: JSON.stringify(claimedMilestones)
    }).where(eq(users.id, userId));
  });

  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
  res.json({ success: true, user: updatedUser });
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
