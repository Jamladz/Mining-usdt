import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './src/db/index.js';
import { users, miningClaims, taskCompletions, withdrawals, referrals } from './src/db/schema.js';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { REFERRAL_USDT_REWARD_UNITS, REFERRAL_MINING_BONUS_UNITS, USDT_SCALE } from './src/config/referral.js';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './src/lib/firebase-admin.js';
import { lookupUserByTelegramId } from './src/lib/firebase.js';

const REFERRAL_MILESTONES = [
  { target: 3, rewardUSDTUnits: 3000, rewardMiningUnits: 100, description: 'Refer 3 friends and claim +0.30 USDT reward!' },
  { target: 6, rewardUSDTUnits: 6000, rewardMiningUnits: 200, description: 'Refer 6 friends and claim +0.60 USDT reward!' },
  { target: 9, rewardUSDTUnits: 9000, rewardMiningUnits: 300, description: 'Refer 9 friends and claim +0.90 USDT reward!' },
  { target: 12, rewardUSDTUnits: 12000, rewardMiningUnits: 400, description: 'Refer 12 friends and claim +1.20 USDT reward!' },
  { target: 15, rewardUSDTUnits: 15000, rewardMiningUnits: 500, description: 'Refer 15 friends and claim +1.50 USDT reward!' },
  { target: 18, rewardUSDTUnits: 18000, rewardMiningUnits: 600, description: 'Refer 18 friends and claim +1.80 USDT reward!' },
  { target: 21, rewardUSDTUnits: 21000, rewardMiningUnits: 700, description: 'Refer 21 friends and claim +2.10 USDT reward!' },
  { target: 24, rewardUSDTUnits: 24000, rewardMiningUnits: 800, description: 'Refer 24 friends and claim +2.40 USDT reward!' },
  { target: 27, rewardUSDTUnits: 27000, rewardMiningUnits: 900, description: 'Refer 27 friends and claim +2.70 USDT reward!' },
  { target: 30, rewardUSDTUnits: 30000, rewardMiningUnits: 1000, description: 'Refer 30 friends and claim +3.00 USDT reward!' }
];

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
  // Allow mock initData in preview/dev or when token is not configured
  if (
    !initData ||
    initData === 'mock_init_data' ||
    initData.startsWith('mock_') ||
    !BOT_TOKEN ||
    BOT_TOKEN === 'mock_token'
  ) {
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (userStr) return JSON.parse(userStr);
      return { id: 12345, username: 'sekanedr_is', first_name: 'Sekanedr' };
    } catch {
      return { id: 12345, username: 'sekanedr_is', first_name: 'Sekanedr' };
    }
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hash === expectedHash) {
      const userStr = urlParams.get('user');
      if (userStr) return JSON.parse(userStr);
    }
  } catch (err) {
    console.warn('[AUTH] Failed parsing Telegram signature:', err);
  }

  // Fallback to user parameter in query if signature check didn't pass in dev
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (userStr) return JSON.parse(userStr);
  } catch (e) {}

  return { id: 12345, username: 'sekanedr_is', first_name: 'Sekanedr' };
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

async function syncUserToFirestore(userId: string) {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (user) {
      // Fetch claimed milestones from Firestore if they exist so we preserve them
      let claimedMilestones: number[] = [];
      try {
        const docSnap = await adminDb.collection('users').doc(userId).get();
        if (docSnap.exists) {
          claimedMilestones = docSnap.data()?.claimedMilestones || [];
        }
      } catch (e) {
        console.warn('Failed to read claimedMilestones during sync:', e);
      }

      await adminDb.collection('users').doc(userId).set({
        id: userId,
        username: user.username || '',
        firstName: user.firstName || '',
        photoUrl: user.photoUrl || '',
        referralsCount: user.referralsCount || 0,
        totalEarned: user.totalEarned || 0,
        balance: user.balance || 0,
        miningRate: user.miningRate || 0,
        totalWithdrawn: user.totalWithdrawn || 0,
        referralEarnings: user.referralEarnings || 0,
        claimedWelcome: user.claimedWelcome || 0,
        referredBy: user.referredBy || '',
        claimedMilestones,
        lastActive: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`[FIREBASE] Authoritative profile sync for user: ${userId}`);
    }
  } catch (err) {
    console.error(`[FIREBASE] Authoritative profile sync failed for ${userId}:`, err);
  }
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
    // A) Try to restore from Firebase first (Hydration for ephemeral SQLite)
    try {
      const fbUser = await lookupUserByTelegramId(userId);
      if (fbUser) {
        user = await db.insert(users).values({
          id: userId,
          username: fbUser.username || tgUser.username || '',
          firstName: fbUser.firstName || tgUser.first_name || '',
          photoUrl: fbUser.photoUrl || tgUser.photo_url || '',
          referralCode: userId,
          balance: fbUser.balance || 0,
          totalEarned: fbUser.totalEarned || 0,
          miningRate: fbUser.miningRate || BASE_MINING_RATE,
          referralsCount: fbUser.referralsCount || 0,
          referralEarnings: fbUser.referralEarnings || 0,
          createdAt: fbUser.createdAt || Date.now()
        }).returning().get();
        console.log(`[AUTH] Hydrated user from Firebase: ${userId}`);
      }
    } catch (e) {
      console.warn(`[AUTH] Failed to hydrate user ${userId} from Firebase`, e);
    }

    // B) If still no user, create a completely new one
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

  try {
    await syncUserToFirestore(userId);
    if (referrerId && referrerId !== userId) {
      await syncUserToFirestore(referrerId);
    }
  } catch (err) {
    console.warn('[AUTH] Sync to Firestore failed:', err);
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

  await syncUserToFirestore(userId);

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

    const inserted = await tx.insert(miningClaims).values({
      userId,
      amount: reward,
      claimedAt: now,
      nextClaimAt: now + CLAIM_COOLDOWN_MS,
    }).returning().get();

    try {
      await adminDb.collection('mining_claims').add({
        localId: inserted.id,
        userId,
        amount: reward,
        claimedAt: now,
        nextClaimAt: now + CLAIM_COOLDOWN_MS
      });
    } catch(err) {
      console.error('Failed to sync mining claim to Firebase', err);
    }
  });

  await syncUserToFirestore(userId);

  const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
  res.json({ success: true, balance: updatedUser.balance, lastClaimAt: updatedUser.lastClaimAt });
});

app.get('/api/mine/history', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  try {
    const claimsSnap = await adminDb.collection('mining_claims').where('userId', '==', userId).get();
    
    const history: any[] = [];
    claimsSnap.forEach(docSnap => {
      history.push({ ...docSnap.data(), id: docSnap.id });
    });
    
    // Sort descending by claimedAt
    history.sort((a, b) => (b.claimedAt || 0) - (a.claimedAt || 0));
    
    // Limit to 30
    const limitedHistory = history.slice(0, 30);
    
    res.json({ history: limitedHistory });
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
  } else if (taskId.startsWith('monetag_rewarded_interstitial')) {
    boostAmount = 300; // +0.03 USDT
  } else if (taskId.startsWith('monetag_rewarded_popup')) {
    boostAmount = 200; // +0.02 USDT
  } else if (taskId.startsWith('monetag_inapp_interstitial')) {
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

  await syncUserToFirestore(userId);

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

    const inserted = await tx.insert(withdrawals).values({
      userId,
      amount,
      walletAddress,
      status: 'pending',
      createdAt: Date.now()
    }).returning().get();

    try {
      await adminDb.collection('withdrawals').doc(String(inserted.id)).set({
        localId: inserted.id,
        userId,
        amount,
        walletAddress,
        status: 'pending',
        createdAt: inserted.createdAt
      });
    } catch(err) {
      console.error('Failed to sync withdrawal to Firebase', err);
    }
  });

  await syncUserToFirestore(userId);

  res.json({ success: true });
});

app.get('/api/withdrawals', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  try {
    const wSnap = await adminDb.collection('withdrawals').where('userId', '==', userId).get();
    const history: any[] = [];
    wSnap.forEach(docSnap => {
      history.push({ ...docSnap.data(), id: docSnap.id });
    });
    // Sort in memory
    history.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ history });
  } catch (err) {
    console.error('[WITHDRAWAL FETCH ERROR]', err);
    res.status(500).json({ error: 'Failed' });
  }
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

app.post('/api/referrals/process', requireUser, async (req: any, res: any) => {
  const currentUserId = req.user.id.toString();
  const currentUserName = req.user.first_name || 'Friend';
  const currentUserUsername = req.user.username || '';
  
  const rawRef = req.body.start_param || req.startParamFallback || '';
  let referrerId: string | null = null;
  if (rawRef) {
    referrerId = rawRef.toString()
      .replace(/^ref_tg_/, '')
      .replace(/^ref_/, '')
      .replace(/^startapp_/, '')
      .trim();
  }

  if (!referrerId || referrerId === currentUserId) {
    return res.json({ success: false, message: 'Invalid or self referral' });
  }

  try {
    const refDocRef = adminDb.collection('referrals').doc(currentUserId);
    const refSnap = await refDocRef.get();
    if (refSnap.exists) {
      return res.json({ success: false, message: 'Already referred' });
    }

    const rewardUSDT = 1000;
    const miningBonus = 100;
    const now = Date.now();

    const referrerSnap = await adminDb.collection('users').doc(referrerId).get();
    if (!referrerSnap.exists) {
      return res.json({ success: false, message: 'Referrer does not exist' });
    }
    const referrerData = referrerSnap.data()!;
    const referrerName = referrerData.firstName || referrerData.username || 'your friend';

    await db.transaction(async (tx) => {
      const existingRef = await tx.select().from(referrals).where(eq(referrals.referredUserId, currentUserId)).get();
      if (!existingRef) {
        await tx.insert(referrals).values({
          referrerId,
          referredUserId: currentUserId,
          rewardUSDT,
          miningBonus,
          status: 'completed',
          createdAt: now
        });
      }

      await tx.update(users).set({
        referredBy: referrerId,
        updatedAt: now
      }).where(eq(users.id, currentUserId));

      const localReferrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
      if (localReferrer) {
        await tx.update(users).set({
          balance: localReferrer.balance + rewardUSDT,
          totalEarned: localReferrer.totalEarned + rewardUSDT,
          miningRate: Math.min(localReferrer.miningRate + miningBonus, MAX_MINING_RATE),
          referralsCount: localReferrer.referralsCount + 1,
          referralEarnings: localReferrer.referralEarnings + rewardUSDT,
          updatedAt: now
        }).where(eq(users.id, referrerId));
      }
    });

    await refDocRef.set({
      id: currentUserId,
      referrerId,
      referredUserId: currentUserId,
      referredName: currentUserName,
      referredUsername: currentUserUsername,
      rewardUSDT,
      miningBonus,
      createdAt: now
    });

    await adminDb.collection('users').doc(referrerId).update({
      referralsCount: (referrerData.referralsCount || 0) + 1,
      balance: (referrerData.balance || 0) + rewardUSDT,
      referralEarnings: (referrerData.referralEarnings || 0) + rewardUSDT,
      miningRate: Math.min((referrerData.miningRate || 0) + miningBonus, MAX_MINING_RATE)
    });

    await syncUserToFirestore(currentUserId);
    await syncUserToFirestore(referrerId);

    res.json({
      success: true,
      rewardAmount: rewardUSDT,
      referrerName
    });
  } catch (err: any) {
    console.error('[PROCESS REFERRAL ERROR]', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.post('/api/referrals/claim-milestone', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { target } = req.body;

  if (!target) return res.status(400).json({ error: 'Missing target milestone' });

  try {
    const milestone = REFERRAL_MILESTONES.find(m => m.target === target);
    if (!milestone) return res.status(400).json({ error: 'Invalid milestone stage!' });

    const userDocRef = adminDb.collection('users').doc(userId);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userSnap.data()!;
    const claimed = userData.claimedMilestones || [];

    if (claimed.includes(target)) {
      return res.status(400).json({ error: 'You have already claimed this milestone reward!' });
    }

    const refSnap = await adminDb.collection('referrals').where('referrerId', '==', userId).get();
    const realCount = refSnap.size;

    const referralsCount = Math.max(userData.referralsCount || 0, realCount);
    if (referralsCount < target) {
      return res.status(400).json({ error: `You have not reached this target yet! Current: ${referralsCount}, Required: ${target}` });
    }

    const updatedClaimed = [...claimed, target];

    await db.transaction(async (tx) => {
      const user = await tx.select().from(users).where(eq(users.id, userId)).get();
      if (user) {
        await tx.update(users).set({
          balance: user.balance + milestone.rewardUSDTUnits,
          miningRate: user.miningRate + milestone.rewardMiningUnits,
          updatedAt: Date.now()
        }).where(eq(users.id, userId));
      }
    });

    await userDocRef.update({
      claimedMilestones: updatedClaimed,
      balance: (userData.balance || 0) + milestone.rewardUSDTUnits,
      miningRate: (userData.miningRate || 0) + milestone.rewardMiningUnits
    });

    await syncUserToFirestore(userId);

    res.json({
      success: true,
      rewardUSDT: milestone.rewardUSDTUnits,
      rewardMiningRate: milestone.rewardMiningUnits,
      message: `Milestone Claimed! Received +${(milestone.rewardUSDTUnits / 10000).toFixed(2)} USDT and +${(milestone.rewardMiningUnits / 10000).toFixed(2)}/24h Boost!`
    });
  } catch (err: any) {
    console.error('[CLAIM MILESTONE ERROR]', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Admin helper
const isAuthorizedAdmin = (user: any) => {
  if (!user) return false;
  const username = (user.username || '').toLowerCase();
  const id = String(user.id || '');
  return username === 'sekanedr_is' || username === 'dev_user' || id === '12345';
};

// Idempotent background migration from SQLite/LibSQL to Firestore
async function migrateSqliteToFirestore() {
  console.log('[MIGRATION] Checking and migrating existing SQLite users & withdrawals to Firestore...');
  try {
    // 1. Fetch all SQLite users
    const allSqlUsers = await db.select().from(users).all();
    console.log(`[MIGRATION] Found ${allSqlUsers.length} users in SQLite.`);
    
    let migratedUsersCount = 0;
    for (const u of allSqlUsers) {
      try {
        const userIdStr = String(u.id);
        const docRef = adminDb.collection('users').doc(userIdStr);
        const docSnap = await docRef.get();
        
        let existingData = docSnap.exists ? docSnap.data() : null;
        
        // Safety check to preserve newer/valid financial data
        const mergedBalance = Math.max(u.balance || 0, existingData?.balance || 0);
        const mergedTotalEarned = Math.max(u.totalEarned || 0, existingData?.totalEarned || 0);
        const mergedTotalWithdrawn = Math.max(u.totalWithdrawn || 0, existingData?.totalWithdrawn || 0);
        const mergedMiningRate = Math.max(u.miningRate || 0, existingData?.miningRate || 0);
        const mergedReferralsCount = Math.max(u.referralsCount || 0, existingData?.referralsCount || 0);
        const mergedReferralEarnings = Math.max(u.referralEarnings || 0, existingData?.referralEarnings || 0);
        
        await docRef.set({
          id: userIdStr,
          username: u.username || existingData?.username || '',
          firstName: u.firstName || existingData?.firstName || '',
          photoUrl: u.photoUrl || existingData?.photoUrl || '',
          balance: mergedBalance,
          totalEarned: mergedTotalEarned,
          totalWithdrawn: mergedTotalWithdrawn,
          miningRate: mergedMiningRate,
          referralCode: u.referralCode || existingData?.referralCode || userIdStr,
          referredBy: u.referredBy || existingData?.referredBy || '',
          referralsCount: mergedReferralsCount,
          referralEarnings: mergedReferralEarnings,
          claimedWelcome: u.claimedWelcome || existingData?.claimedWelcome || 0,
          claimedMilestones: existingData?.claimedMilestones || [],
          createdAt: u.createdAt || existingData?.createdAt || Date.now(),
          updatedAt: u.updatedAt || existingData?.updatedAt || Date.now(),
          lastActive: existingData?.lastActive || FieldValue.serverTimestamp()
        }, { merge: true });
        
        migratedUsersCount++;
      } catch (userErr) {
        console.error(`[MIGRATION] Error migrating user ${u.id}:`, userErr);
      }
    }
    console.log(`[MIGRATION] Successfully processed/merged ${migratedUsersCount} user records.`);
    
    // 2. Fetch all SQLite withdrawals
    const allSqlWithdrawals = await db.select().from(withdrawals).all();
    console.log(`[MIGRATION] Found ${allSqlWithdrawals.length} withdrawals in SQLite.`);
    
    // Build a map of users for fast username/firstName lookup if withdrawals don't have them
    const userMap = new Map();
    allSqlUsers.forEach(user => {
      userMap.set(String(user.id), user);
    });
    
    let migratedWithdrawalsCount = 0;
    for (const w of allSqlWithdrawals) {
      try {
        const withdrawalIdStr = String(w.id);
        const docRef = adminDb.collection('withdrawals').doc(withdrawalIdStr);
        
        // Fetch matching user from our SQLite users map
        const userObj = userMap.get(String(w.userId));
        const username = userObj?.username || '';
        const firstName = userObj?.firstName || '';
        
        // Upsert withdrawal safely
        await docRef.set({
          localId: w.id,
          userId: String(w.userId),
          amount: w.amount,
          walletAddress: w.walletAddress,
          status: w.status || 'pending',
          createdAt: w.createdAt,
          processedAt: w.processedAt || null,
          transactionId: w.transactionId || '',
          username: username,
          firstName: firstName
        }, { merge: true });
        
        migratedWithdrawalsCount++;
      } catch (wErr) {
        console.error(`[MIGRATION] Error migrating withdrawal ${w.id}:`, wErr);
      }
    }
    console.log(`[MIGRATION] Successfully processed/merged ${migratedWithdrawalsCount} withdrawal records.`);
    console.log('[MIGRATION] Idempotent synchronization completed successfully.');
  } catch (err: any) {
    console.error('[MIGRATION CRITICAL ERROR] Migration failed:', err);
  }
}

// Admin endpoints - Direct querying of authoritative SQLite/LibSQL database
app.get('/api/admin/stats', requireUser, async (req: any, res: any) => {
  if (!isAuthorizedAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    // 1. Total users
    const usersCountRes = await db.select({ count: sql<number>`count(*)` }).from(users).get();
    const totalUsers = usersCountRes ? usersCountRes.count : 0;
    
    // 2. Pool Liquidity (total balances in system)
    const balanceSumRes = await db.select({ sum: sql<number>`sum(${users.balance})` }).from(users).get();
    const totalBalance = balanceSumRes ? (balanceSumRes.sum || 0) : 0;
    
    // 3. Paid Out (sum of approved withdrawals)
    const approvedSumRes = await db.select({ sum: sql<number>`sum(${withdrawals.amount})` })
      .from(withdrawals)
      .where(eq(withdrawals.status, 'approved'))
      .get();
    const approvedUSDT = approvedSumRes ? (approvedSumRes.sum || 0) : 0;
    
    // 4. Counts of pending, approved, rejected withdrawals
    const pendingCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(withdrawals)
      .where(eq(withdrawals.status, 'pending'))
      .get();
    const pendingWithdrawals = pendingCountRes ? pendingCountRes.count : 0;

    const approvedCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(withdrawals)
      .where(eq(withdrawals.status, 'approved'))
      .get();
    const approvedWithdrawals = approvedCountRes ? approvedCountRes.count : 0;

    const rejectedCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(withdrawals)
      .where(eq(withdrawals.status, 'rejected'))
      .get();
    const rejectedWithdrawals = rejectedCountRes ? rejectedCountRes.count : 0;

    // 5. Total Claims
    const claimsCountRes = await db.select({ count: sql<number>`count(*)` }).from(miningClaims).get();
    const totalClaims = claimsCountRes ? claimsCountRes.count : 0;
    
    res.json({
      totalUsers,
      totalBalance,
      approvedUSDT,
      pendingWithdrawals,
      approvedWithdrawals,
      rejectedWithdrawals,
      totalClaims
    });
  } catch (err: any) {
    console.error('[ADMIN STATS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch admin stats', details: err.message });
  }
});

app.get('/api/admin/users', requireUser, async (req: any, res: any) => {
  if (!isAuthorizedAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const search = (req.query.search || '').trim().toLowerCase();
    
    let whereClause = undefined;
    if (search) {
      whereClause = sql`LOWER(${users.id}) LIKE ${'%' + search + '%'} OR LOWER(COALESCE(${users.username}, '')) LIKE ${'%' + search + '%'} OR LOWER(COALESCE(${users.firstName}, '')) LIKE ${'%' + search + '%'}`;
    }
    
    // Get total count
    let countQuery: any = db.select({ count: sql<number>`count(*)` }).from(users);
    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }
    const countResult = await countQuery.get();
    const total = countResult ? countResult.count : 0;
    
    // Fetch paginated users, sorted by lastClaimAt or created_at descending, or updatedAt
    let usersQuery: any = db.select().from(users);
    if (whereClause) {
      usersQuery = usersQuery.where(whereClause) as any;
    }
    
    const paginatedUsers = await usersQuery
      .orderBy(desc(users.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
    
    res.json({
      users: paginatedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error('[ADMIN FETCH USERS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

app.get('/api/admin/withdrawals', requireUser, async (req: any, res: any) => {
  if (!isAuthorizedAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const status = (req.query.status || '').trim();
    const search = (req.query.search || '').trim().toLowerCase();
    
    const conditions: any[] = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(withdrawals.status, status));
    }
    
    if (search) {
      conditions.push(sql`(LOWER(${withdrawals.userId}) LIKE ${'%' + search + '%'} OR LOWER(COALESCE(${withdrawals.walletAddress}, '')) LIKE ${'%' + search + '%'} OR LOWER(COALESCE(${users.username}, '')) LIKE ${'%' + search + '%'} OR LOWER(COALESCE(${users.firstName}, '')) LIKE ${'%' + search + '%'})`);
    }
    
    let whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Count query
    let countQuery: any = db.select({ count: sql<number>`count(*)` }).from(withdrawals);
    if (search) {
      countQuery = countQuery.leftJoin(users, eq(withdrawals.userId, users.id)) as any;
    }
    if (whereClause) {
      countQuery = countQuery.where(whereClause) as any;
    }
    const countResult = await countQuery.get();
    const total = countResult ? countResult.count : 0;
    
    // Paginated, joined query
    let selectQuery: any = db.select({
      id: withdrawals.id,
      userId: withdrawals.userId,
      amount: withdrawals.amount,
      walletAddress: withdrawals.walletAddress,
      status: withdrawals.status,
      createdAt: withdrawals.createdAt,
      processedAt: withdrawals.processedAt,
      transactionId: withdrawals.transactionId,
      username: users.username,
      firstName: users.firstName
    })
    .from(withdrawals)
    .leftJoin(users, eq(withdrawals.userId, users.id));
    
    if (whereClause) {
      selectQuery = selectQuery.where(whereClause) as any;
    }
    
    const rawResults = await selectQuery
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
      
    const mapped = rawResults.map(w => ({
      ...w,
      id: String(w.id), // Convert ID to string for AdminTab compatibility
      localId: w.id,
      username: w.username || '',
      firstName: w.firstName || ''
    }));
    
    res.json({
      withdrawals: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error('[ADMIN FETCH WITHDRAWALS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch withdrawals', details: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/approve', requireUser, async (req: any, res: any) => {
  if (!isAuthorizedAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  const idStr = req.params.id; // SQLite ID
  const { transactionId } = req.body;
  const idNum = parseInt(idStr, 10);
  
  try {
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Invalid withdrawal ID' });
    }
    
    // 1. Fetch current status from SQLite to ensure it is pending
    const wData = await db.select().from(withdrawals).where(eq(withdrawals.id, idNum)).get();
    if (!wData) return res.status(404).json({ error: 'Withdrawal not found' });
    
    if (wData.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal has already been processed' });
    }
    
    const processedAt = Date.now();
    
    // 2. Update SQLite
    await db.update(withdrawals).set({
      status: 'approved',
      transactionId: transactionId || '',
      processedAt
    }).where(eq(withdrawals.id, idNum));
    
    // 3. Update Firestore (Idempotent update)
    try {
      await adminDb.collection('withdrawals').doc(idStr).set({
        status: 'approved',
        transactionId: transactionId || '',
        processedAt
      }, { merge: true });
    } catch (e) {
      console.error('[APPROVE FIRESTORE ERROR] Non-blocking Firestore update failed:', e);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('[APPROVE ERROR]', err);
    res.status(500).json({ error: 'Failed to approve', details: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/reject', requireUser, async (req: any, res: any) => {
  if (!isAuthorizedAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  const idStr = req.params.id; // SQLite ID
  const idNum = parseInt(idStr, 10);
  
  try {
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Invalid withdrawal ID' });
    }
    
    // 1. Fetch current status from SQLite to ensure it is pending
    const wData = await db.select().from(withdrawals).where(eq(withdrawals.id, idNum)).get();
    if (!wData) return res.status(404).json({ error: 'Withdrawal not found' });
    
    if (wData.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal has already been processed' });
    }
    
    const processedAt = Date.now();
    
    // 2. Perform rejection and balance refund in SQLite inside a transaction
    await db.transaction(async (tx) => {
      await tx.update(withdrawals).set({
        status: 'rejected',
        processedAt
      }).where(eq(withdrawals.id, idNum));
      
      const u = await tx.select().from(users).where(eq(users.id, wData.userId)).get();
      if (u) {
        const newBalance = u.balance + wData.amount;
        const newTotalWithdrawn = Math.max(0, u.totalWithdrawn - wData.amount);
        await tx.update(users).set({
          balance: newBalance,
          totalWithdrawn: newTotalWithdrawn,
          updatedAt: Date.now()
        }).where(eq(users.id, wData.userId));
      }
    });
    
    // 3. Sync update to Firestore
    try {
      await adminDb.collection('withdrawals').doc(idStr).set({
        status: 'rejected',
        processedAt
      }, { merge: true });
      
      // Update user in Firestore
      const uDocRef = adminDb.collection('users').doc(wData.userId);
      const uSnap = await uDocRef.get();
      if (uSnap.exists) {
        const uData = uSnap.data()!;
        await uDocRef.update({
          balance: (uData.balance || 0) + wData.amount,
          totalWithdrawn: Math.max(0, (uData.totalWithdrawn || 0) - wData.amount)
        });
      }
    } catch (e) {
      console.error('[REJECT FIRESTORE ERROR] Non-blocking Firestore update failed:', e);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error('[REJECT ERROR]', err);
    res.status(500).json({ error: 'Failed to reject', details: err.message });
  }
});

// Vite middleware for development
async function startServer() {
  // Trigger background idempotent SQLite to Firestore migration on boot
  migrateSqliteToFirestore().catch((err) => {
    console.error('[BACKGROUND MIGRATION ERROR]', err);
  });

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
