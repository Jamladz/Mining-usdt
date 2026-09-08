import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:local.db' });

async function run() {
  try {
    console.log('Adding columns to users...');
    await client.execute('ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0');
    await client.execute('ALTER TABLE users ADD COLUMN earned_referral_coins INTEGER DEFAULT 0');
    console.log('Columns added.');
  } catch (e) {
    console.log('Error adding columns (they might exist):', e.message);
  }

  try {
    console.log('Recreating referrals table with unique constraint...');
    // Backup data
    const existing = await client.execute('SELECT * FROM referrals');
    
    await client.execute('DROP TABLE referrals');
    await client.execute(`
      CREATE TABLE referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL UNIQUE,
        reward_status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL
      )
    `);

    // Restore data (ignoring duplicates if any)
    for (const row of existing.rows) {
      try {
        await client.execute({
          sql: 'INSERT INTO referrals (referrer_id, referred_user_id, reward_status, created_at) VALUES (?, ?, ?, ?)',
          args: [row.referrer_id, row.referred_user_id, row.reward_status, row.created_at]
        });
      } catch (err) {
        console.log(`Skipping duplicate referral: ${row.referred_user_id}`);
      }
    }
    console.log('Referrals table recreated.');
  } catch (e) {
    console.log('Error recreating referrals table:', e.message);
  }
}

run();
