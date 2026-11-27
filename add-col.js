import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:local.db' });
async function run() {
  try {
    await client.execute('ALTER TABLE users ADD COLUMN has_nft INTEGER DEFAULT 0');
    console.log('Added has_nft column');
  } catch (e) {
    console.log('Column has_nft already exists or error:', e.message);
  }
}
run();
