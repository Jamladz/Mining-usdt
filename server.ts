import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './src/db/index.js';
import { users, miningClaims, taskCompletions, withdrawals, referrals, purchasedNfts, manualTaskSubmissions } from './src/db/schema.js';
import { eq, and, gt, desc, sql, count } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { REFERRAL_USDT_REWARD_UNITS, REFERRAL_MINING_BONUS_UNITS, USDT_SCALE } from './src/config/referral.js';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'mock_token';
const BASE_MINING_RATE = 100; // 0.01 USDT per day base
const MAX_MINING_RATE = 2000; // 0.20 USDT per day max
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_WITHDRAWAL = 60000; // 6 USDT

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
  const allUserTasks = await db.select().from(taskCompletions)
    .where(eq(taskCompletions.userId, userId))
    .all();

  const oneTimeTaskIds = new Set([
    'sys_add_home',
    'sys_join_hot_labs',
    'sys_join_teqoin',
    'sys_join_lamotrade',
    'sys_join_midaso',
    'sys_join_wallet',
    'sys_join_cryptorcs',
    'sys_join_pilotka',
    'sys_join_cryptomint',
    'sys_join_giftsvault',
    'sys_join_walt',
    'sys_join_riftycoin',
    'sys_join_ngm',
    'sys_baat'
  ]);

  const completedTasksData = allUserTasks
    .filter(t => oneTimeTaskIds.has(t.taskId) || t.completedAt > now - ONE_DAY)
    .map(t => ({
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
  try {
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
      const backup = req.body.firestore_backup;
      
      try {
        await db.transaction(async (tx) => {
          user = await tx.insert(users).values({
            id: userId,
            username: tgUser.username || backup?.username || '',
            firstName: tgUser.first_name || backup?.firstName || '',
            photoUrl: tgUser.photo_url || backup?.photoUrl || '',
            referralCode: userId,
            balance: backup?.balance ?? 0,
            totalEarned: backup?.totalEarned ?? 0,
            totalWithdrawn: backup?.totalWithdrawn ?? 0,
            miningRate: backup?.miningRate ?? BASE_MINING_RATE,
            referralsCount: backup?.referralsCount ?? 0,
            referralEarnings: backup?.referralEarnings ?? 0,
            claimedWelcome: backup?.claimedWelcome ?? 0,
            hasNft: backup?.hasNft ?? 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }).returning().get();

          // Restore Mining History if exists in backup
          if (backup?.miningClaimsHistory) {
            try {
              const parsedMining = JSON.parse(backup.miningClaimsHistory);
              if (Array.isArray(parsedMining) && parsedMining.length > 0) {
                for (const claim of parsedMining) {
                  await tx.insert(miningClaims).values({
                    userId: userId,
                    amount: claim.amount,
                    claimedAt: claim.claimedAt,
                    nextClaimAt: claim.nextClaimAt ?? (claim.claimedAt + 24 * 60 * 60 * 1000)
                  });
                }
              }
            } catch (e) {
              console.warn(`[AUTH] Failed to parse miningClaimsHistory for ${userId}`);
            }
          }

          // Restore Withdrawals History if exists in backup
          if (backup?.withdrawalsHistory) {
            try {
              const parsedWds = JSON.parse(backup.withdrawalsHistory);
              if (Array.isArray(parsedWds) && parsedWds.length > 0) {
                for (const wd of parsedWds) {
                  await tx.insert(withdrawals).values({
                    userId: userId,
                    amount: wd.amount,
                    walletAddress: wd.walletAddress,
                    status: wd.status,
                    createdAt: wd.createdAt
                  });
                }
              }
            } catch (e) {
              console.warn(`[AUTH] Failed to parse withdrawalsHistory for ${userId}`);
            }
          }
        });
        console.log(`[AUTH] New user created (restored from Firestore backup): ${userId}`);
      } catch (err) {
        console.warn(`[AUTH] Concurrent registration attempt for ${userId}`, err);
        user = await db.select().from(users).where(eq(users.id, userId)).get();
        if (!user) return res.status(500).json({ error: 'Database error' });
      }
    }

    // 2. Atomic Referral Processing
    if (referrerId && referrerId !== userId && (!user.referredBy || user.referredBy.trim() === '')) {
      if (/^[0-9]{5,25}$/.test(referrerId)) {
        try {
          await db.transaction(async (tx) => {
            const currentUserState = await tx.select().from(users).where(eq(users.id, userId)).get();
            if (!currentUserState || (currentUserState.referredBy && currentUserState.referredBy.trim() !== '')) {
              return;
            }

            let referrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
            if (!referrer) {
              // Create missing referrer on the fly in SQLite to avoid losing the referral
              console.log(`[REFERRAL] Creating missing referrer ${referrerId} on-the-fly in SQLite`);
              await tx.insert(users).values({
                id: referrerId,
                username: '',
                firstName: 'Friend',
                referralCode: referrerId,
                balance: 0,
                totalEarned: 0,
                miningRate: BASE_MINING_RATE,
                referralsCount: 0,
                referralEarnings: 0,
                createdAt: Date.now()
              });
              referrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
            }

            if (!referrer) return;

            const existingRef = await tx.select().from(referrals).where(eq(referrals.referredUserId, userId)).get();
            if (existingRef) return;

            await tx.insert(referrals).values({
              referrerId,
              referredUserId: userId,
              rewardUSDT: REFERRAL_USDT_REWARD_UNITS,
              miningBonus: REFERRAL_MINING_BONUS_UNITS,
              status: 'completed',
              createdAt: Date.now()
            });

            await tx.update(users).set({
              referredBy: referrerId,
              updatedAt: Date.now()
            }).where(eq(users.id, userId));

            await tx.update(users).set({
              balance: (referrer.balance || 0) + REFERRAL_USDT_REWARD_UNITS,
              totalEarned: (referrer.totalEarned || 0) + REFERRAL_USDT_REWARD_UNITS,
              miningRate: Math.min((referrer.miningRate || BASE_MINING_RATE) + REFERRAL_MINING_BONUS_UNITS, MAX_MINING_RATE),
              referralsCount: (referrer.referralsCount || 0) + 1,
              referralEarnings: (referrer.referralEarnings || 0) + REFERRAL_USDT_REWARD_UNITS,
              updatedAt: Date.now()
            }).where(eq(users.id, referrerId));
          });

          user = await db.select().from(users).where(eq(users.id, userId)).get();
        } catch (err: any) {
          console.error('[REFERRAL ERROR]', err);
        }
      }
    }

    if (!isNewUserFlag) {
      await db.update(users).set({ updatedAt: Date.now() }).where(eq(users.id, userId));
    }

    const formattedUser = await getFormattedUser(userId);

    res.json({ 
      user: formattedUser, 
      referralsCount: user!.referralsCount, 
      referralEarnings: user!.referralEarnings,
      isNewUser: isNewUserFlag
    });
  } catch (err) {
    console.error('[AUTH ROUTE ERROR]', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

async function verifyAdminAccess(req: any): Promise<{ allowed: boolean; tgUsername: string; dbUsername: string }> {
  const tgUser = req.user;
  const userId = tgUser?.id?.toString() || '';
  let dbUser = null;
  try {
    if (userId) {
      dbUser = await db.select().from(users).where(eq(users.id, userId)).get();
    }
  } catch (dbErr) {
    console.error('[ADMIN DB FALLBACK ERROR]', dbErr);
  }
  const tgUsername = tgUser?.username || '';
  const dbUsername = dbUser?.username || '';
  const isTgMatch = Boolean(tgUsername && tgUsername.toLowerCase() === 'sekanedr_is');
  const isDbMatch = Boolean(dbUsername && dbUsername.toLowerCase() === 'sekanedr_is');
  return { allowed: isTgMatch || isDbMatch, tgUsername, dbUsername };
}

app.post('/api/admin/sync-firestore', requireUser, async (req: any, res: any) => {
  const authCheck = await verifyAdminAccess(req);
  if (!authCheck.allowed) {
    return res.status(403).json({ error: 'Access Denied: Admin only' });
  }

  const firestoreUsers = Array.isArray(req.body?.users) ? req.body.users : [];
  if (firestoreUsers.length === 0) {
    return res.json({ success: true, syncedUsers: 0, syncedWithdrawals: 0 });
  }

  let syncedUsers = 0;
  let syncedWithdrawals = 0;

  try {
    await db.transaction(async (tx) => {
      for (const fUser of firestoreUsers) {
        const uid = (fUser.id || '').toString().trim();
        if (!uid) continue;

        const existingUser = await tx.select().from(users).where(eq(users.id, uid)).get();
        const fLastActive = typeof fUser.lastActiveMs === 'number' && fUser.lastActiveMs > 0 ? fUser.lastActiveMs : 0;

        if (!existingUser) {
          await tx.insert(users).values({
            id: uid,
            username: fUser.username || '',
            firstName: fUser.firstName || 'User',
            photoUrl: fUser.photoUrl || '',
            referralCode: uid,
            balance: typeof fUser.balance === 'number' ? fUser.balance : 0,
            totalEarned: typeof fUser.totalEarned === 'number' ? fUser.totalEarned : 0,
            totalWithdrawn: typeof fUser.totalWithdrawn === 'number' ? fUser.totalWithdrawn : 0,
            miningRate: typeof fUser.miningRate === 'number' ? fUser.miningRate : BASE_MINING_RATE,
            referralsCount: typeof fUser.referralsCount === 'number' ? fUser.referralsCount : 0,
            referralEarnings: typeof fUser.referralEarnings === 'number' ? fUser.referralEarnings : 0,
            claimedWelcome: typeof fUser.claimedWelcome === 'number' ? fUser.claimedWelcome : 0,
            hasNft: typeof fUser.hasNft === 'number' ? fUser.hasNft : 0,
            createdAt: fLastActive > 0 ? fLastActive : Date.now() - 48 * 60 * 60 * 1000,
            updatedAt: fLastActive > 0 ? fLastActive : Date.now() - 48 * 60 * 60 * 1000
          });
          syncedUsers++;
        } else {
          const mergedUpdatedAt = Math.max(existingUser.updatedAt || 0, fLastActive);
          const mergedBalance = Math.max(existingUser.balance || 0, typeof fUser.balance === 'number' ? fUser.balance : 0);
          const mergedWithdrawn = Math.max(existingUser.totalWithdrawn || 0, typeof fUser.totalWithdrawn === 'number' ? fUser.totalWithdrawn : 0);
          const mergedReferrals = Math.max(existingUser.referralsCount || 0, typeof fUser.referralsCount === 'number' ? fUser.referralsCount : 0);
          const mergedNft = Math.max(existingUser.hasNft || 0, typeof fUser.hasNft === 'number' ? fUser.hasNft : 0);

          if (
            mergedUpdatedAt !== existingUser.updatedAt ||
            mergedBalance !== existingUser.balance ||
            mergedWithdrawn !== existingUser.totalWithdrawn ||
            mergedReferrals !== existingUser.referralsCount ||
            mergedNft !== existingUser.hasNft ||
            (!existingUser.username && fUser.username) ||
            (!existingUser.firstName && fUser.firstName)
          ) {
            await tx.update(users).set({
              username: existingUser.username || fUser.username || '',
              firstName: existingUser.firstName || fUser.firstName || 'User',
              photoUrl: existingUser.photoUrl || fUser.photoUrl || '',
              balance: mergedBalance,
              totalWithdrawn: mergedWithdrawn,
              referralsCount: mergedReferrals,
              hasNft: mergedNft,
              updatedAt: mergedUpdatedAt
            }).where(eq(users.id, uid));
            syncedUsers++;
          }
        }

        if (fUser.withdrawalsHistory) {
          try {
            const parsedWds = typeof fUser.withdrawalsHistory === 'string'
              ? JSON.parse(fUser.withdrawalsHistory)
              : fUser.withdrawalsHistory;

            if (Array.isArray(parsedWds)) {
              for (const wd of parsedWds) {
                if (!wd || !wd.amount) continue;
                const wdCreatedAt = wd.createdAt || Date.now();
                const existingWd = await tx.select()
                  .from(withdrawals)
                  .where(and(eq(withdrawals.userId, uid), eq(withdrawals.createdAt, wdCreatedAt)))
                  .get();

                if (!existingWd) {
                  await tx.insert(withdrawals).values({
                    userId: uid,
                    amount: Number(wd.amount) || 0,
                    walletAddress: wd.walletAddress || 'TRC20/BEP20 Wallet',
                    status: wd.status || 'pending',
                    transactionId: wd.transactionId || null,
                    createdAt: wdCreatedAt,
                    processedAt: wd.processedAt || null
                  });
                  syncedWithdrawals++;
                }
              }
            }
          } catch (e) {
            // Ignore malformed JSON
          }
        }
      }
    });

    res.json({ success: true, syncedUsers, syncedWithdrawals });
  } catch (err: any) {
    console.error('[ADMIN FIRESTORE SYNC ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to sync Firestore data' });
  }
});

app.get('/api/admin/stats', requireUser, async (req: any, res: any) => {
  const authCheck = await verifyAdminAccess(req);
  if (!authCheck.allowed) {
    console.warn('[ADMIN ACCESS DENIED]', authCheck);
    return res.status(403).json({ 
      error: `Access Denied: This panel is exclusively for sekanedr_is.`,
      debug: authCheck
    });
  }
  
  try {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const [
      allUsers,
      allWithdrawals,
      recentClaims,
      recentTasks,
      allManualTasks
    ] = await Promise.all([
      db.select().from(users).all(),
      db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).all(),
      db.select({ userId: miningClaims.userId, claimedAt: miningClaims.claimedAt })
        .from(miningClaims)
        .where(gt(miningClaims.claimedAt, twentyFourHoursAgo))
        .all(),
      db.select({ userId: taskCompletions.userId, completedAt: taskCompletions.completedAt })
        .from(taskCompletions)
        .where(gt(taskCompletions.completedAt, twentyFourHoursAgo))
        .all(),
      db.select().from(manualTaskSubmissions).orderBy(desc(manualTaskSubmissions.createdAt)).all()
    ]);

    // Build map of users and activity timestamps
    const userMap = new Map<string, any>();
    for (const u of allUsers) {
      userMap.set(u.id, u);
    }

    const activeUserIds24h = new Set<string>();
    const latestActivityByUser = new Map<string, number>();

    for (const u of allUsers) {
      const lastAct = Math.max(u.updatedAt || 0, u.lastClaimAt || 0, u.createdAt || 0);
      latestActivityByUser.set(u.id, lastAct);
      if (lastAct >= twentyFourHoursAgo) {
        activeUserIds24h.add(u.id);
      }
    }

    for (const c of recentClaims) {
      activeUserIds24h.add(c.userId);
      const prev = latestActivityByUser.get(c.userId) || 0;
      if ((c.claimedAt || 0) > prev) latestActivityByUser.set(c.userId, c.claimedAt);
    }

    for (const t of recentTasks) {
      activeUserIds24h.add(t.userId);
      const prev = latestActivityByUser.get(t.userId) || 0;
      if ((t.completedAt || 0) > prev) latestActivityByUser.set(t.userId, t.completedAt);
    }

    for (const w of allWithdrawals) {
      if ((w.createdAt || 0) >= twentyFourHoursAgo) {
        activeUserIds24h.add(w.userId);
      }
      const prev = latestActivityByUser.get(w.userId) || 0;
      if ((w.createdAt || 0) > prev) latestActivityByUser.set(w.userId, w.createdAt);
    }

    let newUsers24h = 0;
    let nftLvl1Count = 0;
    let nftLvl2Count = 0;
    let verifiedReferrersCount = 0;
    let eligibleForWithdrawalCount = 0;
    let totalPlatformBalance = 0;
    let totalPlatformEarned = 0;
    let totalPlatformWithdrawn = 0;
    let totalReferralsSum = 0;

    for (const u of allUsers) {
      if ((u.createdAt || 0) >= twentyFourHoursAgo) {
        newUsers24h++;
      }
      if (u.hasNft === 1) nftLvl1Count++;
      if ((u.hasNft || 0) >= 2) nftLvl2Count++;
      if ((u.referralsCount || 0) >= 3) verifiedReferrersCount++;
      if (((u.referralsCount || 0) >= 3 && (u.hasNft || 0) >= 1) || (u.balance || 0) >= MIN_WITHDRAWAL) {
        eligibleForWithdrawalCount++;
      }
      totalPlatformBalance += (u.balance || 0);
      totalPlatformEarned += (u.totalEarned || 0);
      totalPlatformWithdrawn += (u.totalWithdrawn || 0);
      totalReferralsSum += (u.referralsCount || 0);
    }

    // Enrich withdrawals with user info
    let pendingWithdrawalsCount = 0;
    let completedWithdrawalsCount = 0;
    let rejectedWithdrawalsCount = 0;
    let pendingWithdrawalsAmount = 0;
    let completedWithdrawalsAmount = 0;
    let totalWithdrawalsAmount = 0;

    const enrichedWithdrawals = allWithdrawals.map((w) => {
      const u = userMap.get(w.userId);
      const status = (w.status || 'pending').toLowerCase();
      const amt = Number(w.amount) || 0;
      totalWithdrawalsAmount += amt;

      if (status === 'completed' || status === 'approved') {
        completedWithdrawalsCount++;
        completedWithdrawalsAmount += amt;
      } else if (status === 'rejected') {
        rejectedWithdrawalsCount++;
      } else {
        pendingWithdrawalsCount++;
        pendingWithdrawalsAmount += amt;
      }

      return {
        id: w.id,
        userId: w.userId,
        username: u?.username || '',
        firstName: u?.firstName || 'User',
        photoUrl: u?.photoUrl || '',
        userBalance: u?.balance || 0,
        userTotalWithdrawn: u?.totalWithdrawn || 0,
        userReferralsCount: u?.referralsCount || 0,
        userHasNft: u?.hasNft || 0,
        amount: amt,
        walletAddress: w.walletAddress,
        status: w.status || 'pending',
        transactionId: w.transactionId || null,
        createdAt: w.createdAt,
        processedAt: w.processedAt || null
      };
    });

    // Also include users who have totalWithdrawn > 0 in their profile but no rows in `withdrawals` table yet
    const usersWithWithdrawnRows = new Set(allWithdrawals.map(w => w.userId));
    for (const u of allUsers) {
      if ((u.totalWithdrawn || 0) > 0 && !usersWithWithdrawnRows.has(u.id)) {
        completedWithdrawalsCount++;
        completedWithdrawalsAmount += (u.totalWithdrawn || 0);
        totalWithdrawalsAmount += (u.totalWithdrawn || 0);
        enrichedWithdrawals.push({
          id: -Number(u.id.slice(-6) || 1),
          userId: u.id,
          username: u.username || '',
          firstName: u.firstName || 'User',
          photoUrl: u.photoUrl || '',
          userBalance: u.balance || 0,
          userTotalWithdrawn: u.totalWithdrawn || 0,
          userReferralsCount: u.referralsCount || 0,
          userHasNft: u.hasNft || 0,
          amount: u.totalWithdrawn || 0,
          walletAddress: 'Recorded in User Ledger',
          status: 'completed',
          transactionId: null,
          createdAt: u.updatedAt || u.createdAt || now,
          processedAt: u.updatedAt || now
        });
      }
    }

    // Sort enriched users by latest activity
    const enrichedUsers = allUsers.map((u) => {
      const lastActiveAt = latestActivityByUser.get(u.id) || u.updatedAt || u.createdAt || 0;
      const isActive24h = activeUserIds24h.has(u.id);
      return {
        id: u.id,
        username: u.username || '',
        firstName: u.firstName || 'User',
        photoUrl: u.photoUrl || '',
        balance: u.balance || 0,
        totalEarned: u.totalEarned || 0,
        totalWithdrawn: u.totalWithdrawn || 0,
        miningRate: u.miningRate || BASE_MINING_RATE,
        referralsCount: u.referralsCount || 0,
        hasNft: u.hasNft || 0,
        createdAt: u.createdAt || 0,
        lastActiveAt,
        isActive24h
      };
    }).sort((a, b) => b.lastActiveAt - a.lastActiveAt);

    const enrichedManualTasks = allManualTasks.map((m) => {
      const u = userMap.get(m.userId);
      return {
        ...m,
        username: u?.username || '',
        firstName: u?.firstName || 'User',
        photoUrl: u?.photoUrl || ''
      };
    });

    const stats = {
      totalUsers: allUsers.length,
      activeUsers24h: activeUserIds24h.size,
      newUsers24h,
      nftOwnersCount: nftLvl1Count + nftLvl2Count,
      nftLvl1Count,
      nftLvl2Count,
      verifiedReferrersCount,
      eligibleForWithdrawalCount,
      totalPlatformBalance,
      totalPlatformEarned,
      totalPlatformWithdrawn: Math.max(totalPlatformWithdrawn, completedWithdrawalsAmount),
      totalReferralsSum,
      withdrawalsSummary: {
        totalCount: enrichedWithdrawals.length,
        pendingCount: pendingWithdrawalsCount,
        completedCount: completedWithdrawalsCount,
        rejectedCount: rejectedWithdrawalsCount,
        totalAmount: totalWithdrawalsAmount,
        pendingAmount: pendingWithdrawalsAmount,
        completedAmount: Math.max(completedWithdrawalsAmount, totalPlatformWithdrawn)
      },
      withdrawals: enrichedWithdrawals,
      usersList: enrichedUsers.slice(0, 200),
      manualTasks: enrichedManualTasks,
      serverTime: new Date().toISOString()
    };

    res.json(stats);
  } catch (err: any) {
    console.error('[ADMIN STATS ERROR]', err);
    res.status(500).json({ error: `Professional stats engine failure: ${err.message || err}` });
  }
});

app.post('/api/admin/withdrawals/update', requireUser, async (req: any, res: any) => {
  const authCheck = await verifyAdminAccess(req);
  if (!authCheck.allowed) {
    return res.status(403).json({ error: 'Unauthorized: Admin only' });
  }

  const { withdrawalId, status, transactionId, refundBalance } = req.body;
  if (!withdrawalId || !['pending', 'completed', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid withdrawalId or status' });
  }

  try {
    const existing = await db.select().from(withdrawals).where(eq(withdrawals.id, Number(withdrawalId))).get();
    if (!existing) {
      return res.status(404).json({ error: 'Withdrawal record not found' });
    }

    const now = Date.now();
    await db.transaction(async (tx) => {
      await tx.update(withdrawals).set({
        status,
        transactionId: transactionId !== undefined ? transactionId : existing.transactionId,
        processedAt: status === 'pending' ? null : now
      }).where(eq(withdrawals.id, Number(withdrawalId)));

      // If rejecting a pending withdrawal and refundBalance is requested, return funds to user balance
      if (status === 'rejected' && existing.status !== 'rejected' && refundBalance !== false) {
        const u = await tx.select().from(users).where(eq(users.id, existing.userId)).get();
        if (u) {
          await tx.update(users).set({
            balance: (u.balance || 0) + existing.amount,
            totalWithdrawn: Math.max(0, (u.totalWithdrawn || 0) - existing.amount),
            updatedAt: now
          }).where(eq(users.id, existing.userId));
        }
      }
    });

    const userHistory = await db.select().from(withdrawals).where(eq(withdrawals.userId, existing.userId)).all();
    res.json({ success: true, userId: existing.userId, history: userHistory });
  } catch (err: any) {
    console.error('[ADMIN WITHDRAWAL UPDATE ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to update withdrawal status' });
  }
});

app.get('/api/admin/manual-tasks', requireUser, async (req: any, res: any) => {
  const authCheck = await verifyAdminAccess(req);
  if (!authCheck.allowed) return res.status(403).json({ error: 'Unauthorized' });

  const submissions = await db.select().from(manualTaskSubmissions).where(eq(manualTaskSubmissions.status, 'pending')).all();
  res.json({ submissions });
});

app.post('/api/admin/tasks/approve', requireUser, async (req: any, res: any) => {
  const authCheck = await verifyAdminAccess(req);
  if (!authCheck.allowed) return res.status(403).json({ error: 'Unauthorized' });

  const { submissionId, status } = req.body;
  if (!submissionId || !status) return res.status(400).json({ error: 'Missing details' });

  const submission = await db.select().from(manualTaskSubmissions).where(eq(manualTaskSubmissions.id, submissionId)).get();
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  await db.transaction(async (tx) => {
    await tx.update(manualTaskSubmissions).set({ status, updatedAt: Date.now() }).where(eq(manualTaskSubmissions.id, submissionId));
    
    if (status === 'approved') {
      const boostAmount = 10000; // 1.00 USDT
      const user = await tx.select().from(users).where(eq(users.id, submission.userId)).get();
      if (user) {
        await tx.update(users).set({ 
          miningRate: Math.min(user.miningRate + boostAmount, MAX_MINING_RATE * 100),
          updatedAt: Date.now()
        }).where(eq(users.id, submission.userId));
        
        await tx.insert(taskCompletions).values({
          userId: submission.userId,
          taskId: submission.taskId,
          provider: 'system',
          reward: boostAmount,
          completedAt: Date.now(),
        });
      }
    }
  });

  res.json({ success: true });
});

app.post('/api/welcome/claim', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const user = await db.select().from(users).where(eq(users.id, userId)).get();

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.claimedWelcome && user.claimedWelcome > 0) {
    return res.status(400).json({ error: 'Welcome bonus already claimed' });
  }

  const WELCOME_BONUS_UNITS = 1000; // 0.10 USDT (10000 = 1.00 USDT)

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
      updatedAt: now,
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
        ['sys_add_home', 'sys_join_hot_labs', 'sys_join_teqoin', 'sys_join_lamotrade', 'sys_join_midaso', 'sys_join_wallet', 'sys_join_cryptorcs', 'sys_join_pilotka', 'sys_join_cryptomint', 'sys_join_giftsvault', 'sys_join_walt', 'sys_join_riftycoin', 'sys_join_ngm'].includes(taskId)
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

  let boostAmount = 10; // +0.001 USDT
  if (taskId === 'sys_add_home') {
    boostAmount = 300; // +0.03 USDT
  } else if (taskId === 'sys_join_hot_labs') {
    boostAmount = 100; // +0.01 USDT
  } else if (taskId === 'sys_join_teqoin') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_lamotrade') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_midaso') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_wallet') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_walt') {
    boostAmount = 5000; // +0.50 USDT
  } else if (taskId === 'sys_join_riftycoin') {
    boostAmount = 5000; // +0.50 USDT
  } else if (taskId === 'sys_join_ngm') {
    boostAmount = 5000; // +0.50 USDT
  } else if (taskId === 'sys_join_pilotka') {
    boostAmount = 10000; // +1.00 USDT
  } else if (taskId === 'sys_join_cryptorcs') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_giftsvault') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId === 'sys_join_cryptomint') {
    boostAmount = 1000; // +0.10 USDT
  } else if (taskId.startsWith('adsgram_reward')) {
    boostAmount = 20; // +0.002 USDT
  } else if (taskId === 'adsgram_task') {
    boostAmount = 30; // +0.003 USDT
  } else if (taskId.startsWith('adsgram_interstitial')) {
    boostAmount = 10; // +0.001 USDT
  } else if (taskId.startsWith('monetag_rewarded_interstitial')) {
    boostAmount = 30; // +0.003 USDT
  } else if (taskId.startsWith('monetag_rewarded_popup')) {
    boostAmount = 20; // +0.002 USDT
  } else if (taskId.startsWith('monetag_inapp_interstitial')) {
    boostAmount = 10; // +0.001 USDT
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

    await tx.update(users).set({ miningRate: newRate, updatedAt: now }).where(eq(users.id, userId));
  });

  res.json({ success: true, newRate });
});

app.post('/api/purchase-nft', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { nftId, price } = req.body;
  
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Define boost based on Level
  let boostAmount = 1000; // Default +0.10 USDT
  let level = 1;

  if (nftId === 'lvl1') {
    boostAmount = 10000; // +1.00 USDT/day
    level = 1;
  } else if (nftId === 'lvl2') {
    boostAmount = 35000; // +3.50 USDT/day
    level = 2;
  }
  
  const newRate = Math.min(user.miningRate + boostAmount, MAX_MINING_RATE * 100); // Allow higher rate for NFTs
  
  await db.transaction(async (tx) => {
    // Record the specific purchase
    await tx.insert(purchasedNfts).values({
      userId,
      nftId,
      level,
      price: price || 0,
      purchasedAt: Date.now()
    });

    // Update user state
    await tx.update(users).set({ 
      hasNft: level, // Use level instead of just 1
      miningRate: newRate,
      updatedAt: Date.now()
    }).where(eq(users.id, userId));
  });

  const updatedUser = await getFormattedUser(userId);
  res.json({ success: true, user: updatedUser });
});

app.get('/api/nft-stats', async (req, res) => {
  try {
    const lvl1Count = await db.select({ value: count() }).from(purchasedNfts).where(eq(purchasedNfts.level, 1)).get();
    const lvl2Count = await db.select({ value: count() }).from(purchasedNfts).where(eq(purchasedNfts.level, 2)).get();

    res.json({
      lvl1: {
        sold: 36000 + (lvl1Count?.value || 0),
        total: 100000
      },
      lvl2: {
        sold: 8300 + (lvl2Count?.value || 0),
        total: 10000
      }
    });
  } catch (err) {
    console.error('Failed to fetch NFT stats:', err);
    res.json({
      lvl1: { sold: 36000, total: 100000 },
      lvl2: { sold: 8300, total: 10000 }
    });
  }
});

app.get('/api/tasks', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const completed = await db.select().from(taskCompletions).where(eq(taskCompletions.userId, userId)).all();
  res.json({ completedTasks: completed.map(c => c.taskId) });
});

app.post('/api/tasks/submit-manual', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { taskId, externalUsername } = req.body;

  if (!taskId || !externalUsername) {
    return res.status(400).json({ error: 'Missing task ID or username' });
  }

  const now = Date.now();
  const FOUR_HOURS = 4 * 60 * 60 * 1000;

  // Check for existing pending submission
  const existing = await db.select().from(manualTaskSubmissions)
    .where(
      and(
        eq(manualTaskSubmissions.userId, userId),
        eq(manualTaskSubmissions.taskId, taskId)
      )
    )
    .orderBy(desc(manualTaskSubmissions.createdAt))
    .get();

  if (existing) {
    if (existing.status === 'approved') {
      return res.status(400).json({ error: 'Task already completed' });
    }
    
    // If pending and less than 4 hours, cannot resubmit
    if (existing.status === 'pending' && now - existing.createdAt < FOUR_HOURS) {
      const timeLeft = FOUR_HOURS - (now - existing.createdAt);
      return res.status(400).json({ 
        error: 'Task is still under review', 
        timeLeft,
        status: 'pending'
      });
    }
    
    // If pending and > 4 hours, or rejected, they can submit again (it will update or create new)
  }

  await db.insert(manualTaskSubmissions).values({
    userId,
    taskId,
    externalUsername,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  res.json({ success: true, status: 'pending' });
});

app.get('/api/tasks/manual-status/:taskId', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { taskId } = req.params;

  const submission = await db.select().from(manualTaskSubmissions)
    .where(
      and(
        eq(manualTaskSubmissions.userId, userId),
        eq(manualTaskSubmissions.taskId, taskId)
      )
    )
    .orderBy(desc(manualTaskSubmissions.createdAt))
    .get();

  if (!submission) {
    return res.json({ status: 'not_submitted' });
  }

  const now = Date.now();
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  let effectiveStatus = submission.status;

  // If pending and > 4 hours, it's considered "can_retry" or "not_verified"
  if (submission.status === 'pending' && now - submission.createdAt > FOUR_HOURS) {
    effectiveStatus = 'expired';
  }

  res.json({ 
    status: effectiveStatus, 
    createdAt: submission.createdAt,
    externalUsername: submission.externalUsername 
  });
});

app.post('/api/withdraw', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { amount, walletAddress } = req.body;
  
  if (!amount || !walletAddress) return res.status(400).json({ error: 'Missing withdrawal details' });
  if (amount < MIN_WITHDRAWAL) return res.status(400).json({ error: 'Minimum withdrawal is 6 USDT' });

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.hasNft || user.hasNft < 1) {
    return res.status(400).json({ error: 'You must purchase at least the Level 1 NFT to enable withdrawals.' });
  }

  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      balance: user.balance - amount,
      totalWithdrawn: user.totalWithdrawn + amount,
      updatedAt: Date.now()
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

app.post('/api/withdraw/log-request', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { amount, walletAddress } = req.body;
  if (!amount || !walletAddress) {
    return res.json({ logged: false });
  }

  try {
    const now = Date.now();
    const recentPending = await db.select()
      .from(withdrawals)
      .where(and(eq(withdrawals.userId, userId), eq(withdrawals.status, 'pending')))
      .orderBy(desc(withdrawals.createdAt))
      .get();

    // Avoid duplicate spam within 10 minutes for same user
    if (recentPending && now - recentPending.createdAt < 10 * 60 * 1000) {
      await db.update(withdrawals).set({
        amount: Number(amount) || recentPending.amount,
        walletAddress: walletAddress.trim()
      }).where(eq(withdrawals.id, recentPending.id));
    } else {
      await db.insert(withdrawals).values({
        userId,
        amount: Number(amount) || MIN_WITHDRAWAL,
        walletAddress: walletAddress.trim(),
        status: 'pending',
        createdAt: now
      });
    }

    await db.update(users).set({ updatedAt: now }).where(eq(users.id, userId));
    const history = await db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).all();
    res.json({ logged: true, history });
  } catch (err) {
    console.warn('[WITHDRAW LOG REQUEST ERROR]', err);
    res.json({ logged: false });
  }
});

app.get('/api/withdrawals', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const history = await db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).all();
  res.json({ history });
});

app.post('/api/withdrawals/sync', requireUser, async (req: any, res: any) => {
  const userId = req.user.id.toString();
  const { history } = req.body;
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: 'History must be an array' });
  }

  try {
    await db.transaction(async (tx) => {
      for (const item of history) {
        // Check if there is already a withdrawal for this user with the same createdAt
        const existing = await tx.select()
          .from(withdrawals)
          .where(
            and(
              eq(withdrawals.userId, userId),
              eq(withdrawals.createdAt, item.createdAt)
            )
          )
          .get();

        if (!existing) {
          await tx.insert(withdrawals).values({
            userId,
            amount: item.amount,
            walletAddress: item.walletAddress || 'RESTORED_WALLET',
            status: item.status || 'pending',
            createdAt: item.createdAt,
            processedAt: item.processedAt || null,
            transactionId: item.transactionId || null
          });
        }
      }
    });

    const updatedHistory = await db.select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .all();
    
    res.json({ success: true, history: updatedHistory });
  } catch (err: any) {
    console.error('[WITHDRAWAL SYNC ERROR]', err);
    res.status(500).json({ error: err.message || 'Failed to sync withdrawal history' });
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

  res.json({ 
    referrals: friendDetails 
  });
});

// Catch-all for unknown API routes - MUST be after all valid API routes
app.all('/api/*path', (req, res) => {
  console.log(`[API 404] ${req.method} ${req.url}`);
  res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
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
    app.get('*path', (req, res) => {
      // Ensure we don't serve index.html for missing /api routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
