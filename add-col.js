import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:local.db' });
async function run() {
  try {
    await client.execute('ALTER TABLE users ADD COLUMN claimed_milestones TEXT DEFAULT "[]"');
    console.log('Added column');
  } catch (e) {
    console.log('Column already exists or error:', e.message);
  }
}
run();
