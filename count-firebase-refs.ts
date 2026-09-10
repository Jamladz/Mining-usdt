import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
async function run() {
  const refsRef = collection(db, 'referrals');
  const snap = await getDocs(refsRef);
  const counts: Record<string, number> = {};
  snap.forEach(docSnap => {
    const data = docSnap.data();
    counts[data.referrerId] = (counts[data.referrerId] || 0) + 1;
  });
  console.log('Firebase Referral counts by referrerId:', counts);
  process.exit(0);
}
run().catch(console.error);
