import { initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
try { getApp(); } catch { initializeApp({ projectId: firebaseConfig.projectId }); }
const db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
async function run() {
  const usersRef = db.collection('users');
  const snap = await usersRef.get();
  snap.forEach(doc => {
    const data = doc.data();
    if (data.referralsCount > 0 || data.username?.toLowerCase().includes('sekan')) {
      console.log(`ID: ${doc.id}, Username: ${data.username}, Referrals: ${data.referralsCount}, Name: ${data.firstName}`);
    }
  });
}
run().catch(console.error);
