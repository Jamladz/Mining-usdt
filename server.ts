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
const MIN_WITHDRAWAL = 20000; // 2 USDT

const MILESTONES = [
  { id: 'm1', target: 3, rewardUsdt: 3000, rewardRate: 500 }, // 0.3 USDT, +0.05 Rate
  { id: 'm2', target: 10, rewardUsdt: 10000, rewardRate: 1000 }, // 1.0 USDT, +0.10 Rate
  { id: 'm3', target: 25, rewardUsdt: 25000, rewardRate: 2000 }, // 2.5 USDT, +0.20 Rate
  { id: 'm4', target: 50, rewardUsdt: 50000, rewardRate: 5000 }, // 5.0 USDT, +0.50 Rate
  { id: 'm5', target: 100, rewardUsdt: 100000, rewardRate: 10000 }, // 10.0 USDT, +1.0 Rate
];

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
  
  if (!user) {
    // Check for referral with robust prefix clearing and trimming
    const rawRef = req.body.start_param || req.startParamFallback || '';
    let referredBy = null;
    if (rawRef) {
      referredBy = rawRef.toString()
        .replace(/^ref_tg_/, '')
        .replace(/^ref_/, '')
        .replace(/^startapp_/, '')
        .trim();
    }

    console.log(`[REFERRAL DEBUG] New User Registration. ID: ${userId}, Raw start_param: "${rawRef}", Resolved referredBy: "${referredBy}"`);

    const WELCOME_BONUS = 7000; // 0.7 USDT
    const REFERRER_CASH_REWARD = 1000; // 0.1 USDT instant reward
    const REFERRER_RATE_BOOST = 200; // +0.02 Mining Rate

    // Atomic Database Transaction for Registration + Referral
    user = await db.transaction(async (tx) => {
      let balanceInit = 0;
      let totalEarnedInit = 0;
      let claimedMilestonesInit = '[]';
      
      if (referredBy && referredBy !== userId) {
        const referrer = await tx.select().from(users).where(eq(users.id, referredBy)).get();
        if (referrer) {
          // Grant Referrer Mining Rate Boost and instant cash reward of 0.1 USDT
          await tx.update(users).set({
            miningRate: Math.min(referrer.miningRate + REFERRER_RATE_BOOST, MAX_MINING_RATE),
            balance: referrer.balance + REFERRER_CASH_REWARD,
            totalEarned: referrer.totalEarned + REFERRER_CASH_REWARD
          }).where(eq(users.id, referredBy));
          
          await tx.insert(referrals).values({
            referrerId: referredBy,
            referredUserId: userId,
            rewardStatus: 'paid',
            createdAt: Date.now()
          });
          
          // Credit welcome bonus to new user balance instantly!
          balanceInit = WELCOME_BONUS;
          totalEarnedInit = WELCOME_BONUS;
          claimedMilestonesInit = JSON.stringify(['welcome_claimed']);
          
          console.log(`[REFERRAL SUCCESS] Recorded referral for referrer: ${referredBy} (+0.1 USDT & +200 Rate) -> referred user: ${userId} (+0.7 USDT welcomed)`);
        } else {
            console.log(`[REFERRAL WARN] Referrer ${referredBy} not found in database. Ignoring referral.`);
            referredBy = null; // Invalid referrer
        }
      }

      const newUser = await tx.insert(users).values({
        id: userId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        photoUrl: tgUser.photo_url || '',
        referralCode: userId,
        referredBy,
        balance: balanceInit,
        totalEarned: totalEarnedInit,
        miningRate: BASE_MINING_RATE,
        claimedMilestones: claimedMilestonesInit
      }).returning().get();
      
      return newUser;
    });
  } else {
    // Check if user doesn't have a referrer yet, but start_param is provided now (retro-active linking)
    const rawRef = req.body.start_param || req.startParamFallback || '';
    let referredBy = null;
    if (rawRef) {
      referredBy = rawRef.toString()
        .replace(/^ref_tg_/, '')
        .replace(/^ref_/, '')
        .replace(/^startapp_/, '')
        .trim();
    }

    console.log(`[REFERRAL DEBUG] Existing User Auth. ID: ${userId}, Raw start_param: "${rawRef}", Resolved referredBy: "${referredBy}", Current referredBy in DB: "${user.referredBy}"`);

    let updatedFields: any = {
      username: tgUser.username || user.username,
      firstName: tgUser.first_name || user.firstName,
      photoUrl: tgUser.photo_url || user.photoUrl,
    };

    if (referredBy && referredBy !== userId && (!user.referredBy || user.referredBy.trim() === '')) {
      // Validate referrer exists
      const referrer = await db.select().from(users).where(eq(users.id, referredBy)).get();
      if (referrer) {
        const REFERRER_RATE_BOOST = 200; // +0.02 Mining Rate
        const REFERRER_CASH_REWARD = 1000; // 0.1 USDT instant reward
        const WELCOME_BONUS = 7000; // 0.7 USDT welcome bonus
        const MAX_MINING_RATE = 100000; // 0.15 USDT per day

        // Check if referral record already exists to prevent duplicate entries
        const existingReferral = await db.select().from(referrals)
          .where(
            and(
              eq(referrals.referrerId, referredBy),
              eq(referrals.referredUserId, userId)
            )
          )
          .get();

        if (!existingReferral) {
          // Perform in transaction to keep atomic
          await db.transaction(async (tx) => {
            // Update referrer rate boost and credit 0.1 USDT cash
            await tx.update(users).set({
              miningRate: Math.min(referrer.miningRate + REFERRER_RATE_BOOST, MAX_MINING_RATE),
              balance: referrer.balance + REFERRER_CASH_REWARD,
              totalEarned: referrer.totalEarned + REFERRER_CASH_REWARD
            }).where(eq(users.id, referredBy));

            // Record the referral
            await tx.insert(referrals).values({
              referrerId: referredBy,
              referredUserId: userId,
              rewardStatus: 'paid',
              createdAt: Date.now()
            });
            
            // Credit welcome bonus to current user instantly inside transaction!
            let claimedArr: string[] = [];
            try {
              claimedArr = JSON.parse(user.claimedMilestones || '[]');
            } catch (e) {}
            if (!claimedArr.includes('welcome_claimed')) {
              claimedArr.push('welcome_claimed');
            }
            
            updatedFields.balance = user.balance + WELCOME_BONUS;
            updatedFields.totalEarned = user.totalEarned + WELCOME_BONUS;
            updatedFields.claimedMilestones = JSON.stringify(claimedArr);
          });

          // Set referredBy on current user
          updatedFields.referredBy = referredBy;
          console.log(`[REFERRAL SUCCESS] Retroactively recorded referral for referrer: ${referredBy} (+0.1 USDT & +200 Rate) -> referred user: ${userId} (+0.7 USDT welcomed)`);
        }
      } else {
        console.log(`[REFERRAL WARN] Retro-referrer ${referredBy} not found in database. Ignoring.`);
      }
    }

    // Update profile pic/name & referral if changed
    await db.update(users).set(updatedFields).where(eq(users.id, userId));
    user = await db.select().from(users).where(eq(users.id, userId)).get();
  }

  // Count referrals and calculate earned bonus from claimed milestones
  const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).all();
  
  let referralBonusEarned = 0;
  try {
    const claimedArr = JSON.parse(user.claimedMilestones || '[]');
    for (const milestoneId of claimedArr) {
      if (milestoneId === 'welcome_claimed') continue; // exclude registration bonus
      const ms = MILESTONES.find(m => m.id === milestoneId);
      if (ms) {
        referralBonusEarned += ms.rewardUsdt;
      }
    }
  } catch (e) {}

  const formattedUser = await getFormattedUser(userId);

  res.json({ 
    user: formattedUser, 
    referralsCount: userReferrals.length, 
    referralBonusEarned 
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
    const topReferrers = await db.select({
      referrerId: referrals.referrerId,
      count: sql<number>`count(${referrals.id})`
    })
    .from(referrals)
    .groupBy(referrals.referrerId)
    .orderBy(desc(sql`count(${referrals.id})`))
    .limit(20)
    .all();

    const leaderboard = await Promise.all(topReferrers.map(async (row) => {
      const userDetail = await db.select().from(users).where(eq(users.id, row.referrerId)).get();
      return {
        id: row.referrerId,
        username: userDetail?.username || 'Anonymous',
        firstName: userDetail?.firstName || 'User',
        photoUrl: userDetail?.photoUrl || '',
        referralsCount: row.count,
        isCurrentUser: row.referrerId === userId
      };
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

  const userReferrals = await db.select().from(referrals).where(eq(referrals.referrerId, userId)).all();
  if (userReferrals.length < milestone.target) {
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
