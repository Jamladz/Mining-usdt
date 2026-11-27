import { db } from './src/db/index.js';
import { users, referrals } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function test() {
  console.log('Testing referral logic...');
  const referrerId = 'test_referrer_1';
  const newUserId = 'test_new_user_1';

  // Create referrer
  await db.insert(users).values({
    id: referrerId,
    username: 'referrer',
    referralCode: 'ref_tg_' + referrerId,
    balance: 0,
    totalEarned: 0,
    miningRate: 1000
  });

  const WELCOME_BONUS = 5000;
  const REFERRER_REWARD = 5000;
  const REFERRER_RATE_BOOST = 200;

  try {
    const newUser = await db.transaction(async (tx) => {
      let balanceInit = 0;
      let totalEarnedInit = 0;
      
      const referrer = await tx.select().from(users).where(eq(users.id, referrerId)).get();
      if (referrer) {
        balanceInit = WELCOME_BONUS;
        totalEarnedInit = WELCOME_BONUS;

        await tx.update(users).set({
          balance: referrer.balance + REFERRER_REWARD,
          totalEarned: referrer.totalEarned + REFERRER_REWARD,
          miningRate: referrer.miningRate + REFERRER_RATE_BOOST
        }).where(eq(users.id, referrerId));
        
        await tx.insert(referrals).values({
          referrerId: referrerId,
          referredUserId: newUserId,
          rewardStatus: 'paid',
          createdAt: Date.now()
        });
      }

      const created = await tx.insert(users).values({
        id: newUserId,
        username: 'newuser',
        referralCode: 'ref_tg_' + newUserId,
        referredBy: referrerId,
        balance: balanceInit,
        totalEarned: totalEarnedInit,
        miningRate: 1000,
        claimedMilestones: '[]'
      }).returning().get();
      
      return created;
    });

    console.log('Created user:', newUser);

    const refCheck = await db.select().from(referrals).where(eq(referrals.referrerId, referrerId)).all();
    console.log('Referrals count for referrer:', refCheck.length);

  } catch (e) {
    console.error('Transaction error:', e);
  }
}

test();
