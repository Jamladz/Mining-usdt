import { db } from './src/db/index.js';
import { users, referrals } from './src/db/schema.js';

async function check() {
  console.log('--- DATABASE CHECK ---');
  try {
    const allUsers = await db.select().from(users).all();
    console.log(`Total users: ${allUsers.length}`);
    if (allUsers.length > 0) {
      console.log('Sample Users:', allUsers.slice(0, 5).map(u => ({
        id: u.id,
        username: u.username,
        referredBy: u.referredBy,
        miningRate: u.miningRate,
        balance: u.balance
      })));
    }

    const allReferrals = await db.select().from(referrals).all();
    console.log(`Total referrals: ${allReferrals.length}`);
    if (allReferrals.length > 0) {
      console.log('Sample Referrals:', allReferrals.slice(0, 5));
    }
  } catch (e) {
    console.error('Error reading database:', e);
  }
}

check();
