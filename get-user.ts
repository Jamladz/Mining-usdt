import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
async function run() {
  const userRef = doc(db, 'users', '1368899842');
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    console.log('User data:', snap.data());
  } else {
    console.log('User 1368899842 NOT FOUND in users collection!');
  }
  process.exit(0);
}
run().catch(console.error);
