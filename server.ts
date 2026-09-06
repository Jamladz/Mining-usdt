import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './src/db/index.js';
import { users, miningClaims, taskCompletions, withdrawals, referrals } from './src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'mock_token';
const USDT_SCALE = 10000; // 1 USDT = 10000 units
const BASE_MINING_RATE = 1000; // 0.10 USDT per day
const MAX_MINING_RATE = 1500; // 0.15 USDT per day
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_WITHDRAWAL = 20000; // 2 USDT

// Utility: Validate Telegram initData
function validateInitData(initData: string): any {
  if (process.env.NODE_ENV === 'development' || BOT_TOKEN === 'mock_token') {
    // In dev mode without a real token, parse it blindly or return a mock user
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (userStr) return JSON.parse(userStr);
      return { id: 12345, username: 'dev_user', first_name: 'Dev' };
    } catch {
      return { id: 12345, username: 'dev_user', first_name: 'Dev' };
    }
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
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// API ROUTES
app.post('/api/auth', requireUser, async (req: any, res: any) => {
  const tgUser = req.user;
  const userId = tgUser.id.toString();
  
  let user = await db.select().from(users).where(eq(users.id, userId)).get();
  
  if (!user) {
    // Check for referral
    const ref = req.body.start_param;
    let referredBy = null;
    if (ref && ref.startsWith('ref_')) {
      referredBy = ref.replace('ref_', '');
    }

    user = await db.insert(users).values({
      id: userId,
      username: tgUser.username || '',
      firstName: tgUser.first_name || '',
      photoUrl: tgUser.photo_url || '',
      referralCode: `ref_${userId}`,
      referredBy,
      balance: 0,
      totalEarned: 0,
      miningRate: BASE_MINING_RATE,
    }).returning().get();

    // Process referral bonus if valid
    if (referredBy && referredBy !== userId) {
      const referrer = await db.select().from(users).where(eq(users.id, referredBy)).get();
      if (referrer) {
        // Direct bonus: 0.10 USDT (1000 scaled) and +0.005 USDT mining rate (50 scaled)
        const refBonus = 1000;
        const rateBoost = 50; 
        await db.update(users).set({
          balance: referrer.balance + refBonus,
          totalEarned: referrer.totalEarned + refBonus,
          miningRate: Math.min(referrer.miningRate + rateBoost, MAX_MINING_RATE)
        }).where(eq(users.id, referredBy));
        
        await db.insert(referrals).values({
          referrerId: referredBy,
          referredUserId: userId,
          rewardStatus: 'paid',
          createdAt: Date.now()
        });
      }
    }
  } else {
    // Update profile pic/name if changed
    await db.update(users).set({
      username: tgUser.username || user.username,
      firstName: tgUser.first_name || user.firstName,
      photoUrl: tgUser.photo_url || user.photoUrl,
    }).where(eq(users.id, userId));
    user = await db.select().from(users).where(eq(users.id, userId)).get();
  }

  // Count referrals and calculate earned bonus
  const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).all();
  const referralBonusEarned = userReferrals.length * 1000; // 0.10 USDT per referral

  res.json({ user, referralsCount: userReferrals.length, referralBonusEarned });
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

app.post('/api/tasks/complete', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { taskId, provider } = req.body;
  
  if (!taskId || !provider) return res.status(400).json({ error: 'Missing task details' });

  const existing = await db.select().from(taskCompletions)
    .where(and(eq(taskCompletions.userId, userId), eq(taskCompletions.taskId, taskId)))
    .get();

  if (existing) {
    return res.status(400).json({ error: 'Task already completed' });
  }

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Moderate boost: +10% of base rate
  const boostAmount = 100; // +0.01 USDT
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
  if (amount < MIN_WITHDRAWAL) return res.status(400).json({ error: 'Minimum withdrawal is 2 USDT' });

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

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
