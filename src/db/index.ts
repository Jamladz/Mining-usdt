import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export const db = drizzle(client, { schema });

// Safe DB Table Initialization & Migration Helpers
const initDb = async () => {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        photo_url TEXT,
        balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_withdrawn INTEGER DEFAULT 0,
        mining_rate INTEGER DEFAULT 1000,
        referral_code TEXT UNIQUE,
        referred_by TEXT,
        referrals_count INTEGER DEFAULT 0,
        referral_earnings INTEGER DEFAULT 0,
        claimed_welcome INTEGER DEFAULT 0,
        last_claim_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
      )
    `);
  } catch (e) {
    console.warn('Failed to ensure users table exists:', e);
  }

  // Ensure new column referral_earnings exists if users table was created previously
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN referral_earnings INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists or table was newly created
  }
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN claimed_welcome INTEGER DEFAULT 0`);
  } catch (e) {}

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS mining_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL,
        next_claim_at INTEGER NOT NULL
      )
    `);
  } catch (e) {
    console.warn('Failed to ensure mining_claims table exists:', e);
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS task_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        reward INTEGER NOT NULL,
        completed_at INTEGER NOT NULL
      )
    `);
  } catch (e) {
    console.warn('Failed to ensure task_completions table exists:', e);
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL UNIQUE,
        reward_usdt INTEGER DEFAULT 1000,
        mining_bonus INTEGER DEFAULT 100,
        status TEXT DEFAULT 'completed',
        created_at INTEGER NOT NULL
      )
    `);
  } catch (e) {
    console.warn('Failed to ensure referrals table exists:', e);
  }

  // Safe columns migration for referrals table if existing
  try {
    await client.execute(`ALTER TABLE referrals ADD COLUMN reward_usdt INTEGER DEFAULT 1000`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE referrals ADD COLUMN mining_bonus INTEGER DEFAULT 100`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE referrals ADD COLUMN status TEXT DEFAULT 'completed'`);
  } catch (e) {}

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        wallet_address TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        processed_at INTEGER,
        transaction_id TEXT
      )
    `);
  } catch (e) {
    console.warn('Failed to ensure withdrawals table exists:', e);
  }
};

initDb().catch(err => {
  console.error('Critical error initializing database tables:', err);
});
