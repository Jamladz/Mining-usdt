import { db } from './src/db/index.ts';
import { withdrawals } from './src/db/schema.ts';
async function run() {
  const inserted = await db.insert(withdrawals).values({
    userId: '12345',
    amount: 30000,
    walletAddress: 'TXYZ',
    status: 'pending',
    createdAt: Date.now()
  }).returning().get();
  console.log('Inserted:', inserted);
}
run().catch(console.error);
