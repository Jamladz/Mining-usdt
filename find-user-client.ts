import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
async function run() {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.referralsCount > 70 || data.referralsCount === 76) {
      console.log(`FOUND ADMIN! ID: ${docSnap.id}, Username: ${data.username}, Referrals: ${data.referralsCount}, Name: ${data.firstName}`);
    }
  });
}
run().catch(console.error);
