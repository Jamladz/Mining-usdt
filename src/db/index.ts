import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export const db = drizzle(client, { schema });

// Initialize tables if they don't exist (Simple migration for local file)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'file:local.db') {
  client.execute(`
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
      last_claim_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
      claimed_milestones TEXT DEFAULT '[]',
      updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    )
  `);

  client.execute(`
    CREATE TABLE IF NOT EXISTS mining_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      claimed_at INTEGER NOT NULL,
      next_claim_at INTEGER NOT NULL
    )
  `);

  client.execute(`
    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      reward INTEGER NOT NULL,
      completed_at INTEGER NOT NULL
    )
  `);

  client.execute(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      reward_status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )
  `);

  client.execute(`
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
}
