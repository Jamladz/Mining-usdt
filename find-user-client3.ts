import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
async function run() {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  let maxRef = 0;
  let maxUser = null;
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.referralsCount > maxRef) {
      maxRef = data.referralsCount;
      maxUser = data;
    }
  });
  console.log('User with max referrals:', maxUser);
  process.exit(0);
}
run().catch(console.error);
