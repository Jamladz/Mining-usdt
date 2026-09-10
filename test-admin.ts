import { initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
async function run() {
  const s = await db.collection('users').limit(1).get();
  console.log(s.docs.map(d => d.id));
}
run().catch(console.error);
