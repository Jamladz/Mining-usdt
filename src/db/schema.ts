import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  photoUrl: text('photo_url'),
  balance: integer('balance').default(0), // scaled by 10000 (0.10 USDT = 1000)
  totalEarned: integer('total_earned').default(0),
  totalWithdrawn: integer('total_withdrawn').default(0),
  miningRate: integer('mining_rate').default(1000), // base 1000 = 0.10 USDT
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  lastClaimAt: integer('last_claim_at'),
  createdAt: integer('created_at').default(Date.now()),
  updatedAt: integer('updated_at').default(Date.now()),
});

export const miningClaims = sqliteTable('mining_claims', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),
  claimedAt: integer('claimed_at').notNull(),
  nextClaimAt: integer('next_claim_at').notNull(),
});

export const taskCompletions = sqliteTable('task_completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  taskId: text('task_id').notNull(),
  provider: text('provider').notNull(),
  reward: integer('reward').notNull(),
  completedAt: integer('completed_at').notNull(),
});

export const referrals = sqliteTable('referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerId: text('referrer_id').notNull(),
  referredUserId: text('referred_user_id').notNull(),
  rewardStatus: text('reward_status').default('pending'),
  createdAt: integer('created_at').notNull(),
});

export const withdrawals = sqliteTable('withdrawals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),
  walletAddress: text('wallet_address').notNull(),
  status: text('status').default('pending'),
  createdAt: integer('created_at').notNull(),
  processedAt: integer('processed_at'),
  transactionId: text('transaction_id'),
});
