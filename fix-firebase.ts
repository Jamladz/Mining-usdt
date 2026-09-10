import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
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
  
  const usersRef = collection(db, 'users');
  const usersSnap = await getDocs(usersRef);
  
  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const actualCount = counts[docSnap.id] || 0;
    if (data.referralsCount !== actualCount) {
      console.log(`Fixing user ${docSnap.id} (${data.username}): ${data.referralsCount} -> ${actualCount}`);
      await setDoc(doc(db, 'users', docSnap.id), {
        referralsCount: actualCount,
        balance: data.balance || (actualCount * 5000), // simplistic restore if lost
        referralEarnings: data.referralEarnings || (actualCount * 5000)
      }, { merge: true });
    }
  }
  console.log('Done');
  process.exit(0);
}
run().catch(console.error);
