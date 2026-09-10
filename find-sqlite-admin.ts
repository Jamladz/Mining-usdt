import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { eq, gte } from 'drizzle-orm';
async function run() {
  const allUsers = await db.select().from(users).where(gte(users.referralsCount, 70)).all();
  allUsers.forEach(u => {
    console.log(`FOUND ADMIN! ID: ${u.id}, Username: ${u.username}, Referrals: ${u.referralsCount}, Name: ${u.firstName}`);
  });
}
run().catch(console.error);
