import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Synchronize the Telegram user's public details to Firestore.
 * This makes the user searchable by their Telegram ID in the Referral Hub.
 */
export async function syncUserToFirebase(user: any) {
  if (!user || !user.id) return;
  try {
    const userDocRef = doc(db, 'users', user.id.toString());
    await setDoc(userDocRef, {
      id: user.id.toString(),
      username: user.username || '',
      firstName: user.firstName || '',
      photoUrl: user.photoUrl || '',
      referralsCount: user.referralsCount || 0,
      totalEarned: user.totalEarned || 0,
      miningRate: user.miningRate || 0,
      lastActive: serverTimestamp()
    }, { merge: true });
    console.log('[FIREBASE] Synced user profile successfully');
  } catch (err) {
    console.warn('[FIREBASE] Failed to sync user profile:', err);
  }
}

/**
 * Look up a Telegram user by their Telegram ID in Firestore.
 */
export async function lookupUserByTelegramId(telegramId: string) {
  if (!telegramId) return null;
  try {
    const userDocRef = doc(db, 'users', telegramId.trim());
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    console.error('[FIREBASE] User lookup failed:', err);
    throw err;
  }
}
