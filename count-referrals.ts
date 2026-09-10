import { db } from './src/db/index.js';
import { referrals, users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
async function run() {
  const allRefs = await db.select().from(referrals).all();
  const counts: Record<string, number> = {};
  allRefs.forEach(r => {
    counts[r.referrerId] = (counts[r.referrerId] || 0) + 1;
  });
  console.log('Referral counts:', counts);
  const allUsers = await db.select().from(users).all();
  console.log('User sekanedr_is:', allUsers.find(u => u.username?.toLowerCase() === 'sekanedr_is'));
}
run().catch(console.error);
