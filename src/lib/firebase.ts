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
      balance: user.balance || 0,
      totalEarned: user.totalEarned || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
      miningRate: user.miningRate || 1000,
      referralsCount: user.referralsCount || 0,
      referralEarnings: user.referralEarnings || 0,
      claimedWelcome: user.claimedWelcome || 0,
      claimedMilestones: typeof user.claimedMilestones === 'string' ? user.claimedMilestones : JSON.stringify(user.claimedMilestones || []),
      lastActive: serverTimestamp()
    }, { merge: true });
    console.log('[FIREBASE] Synced user profile successfully');
  } catch (err) {
    console.warn('[FIREBASE] Failed to sync user profile:', err);
  }
}

/**
 * Get user profile directly from Firestore.
 */
export async function getUserFromFirebase(userId: string) {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId.toString());
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    console.error('[FIREBASE] Failed to get user:', err);
    return null;
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
