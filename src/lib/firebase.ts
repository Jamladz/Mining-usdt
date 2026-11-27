import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
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
      hasNft: user.hasNft || 0,
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

export async function syncHistoryToFirebase(userId: string, historyKey: 'miningClaimsHistory' | 'withdrawalsHistory', historyData: any[]) {
  if (!userId || !historyKey || !historyData) return;
  try {
    const userDocRef = doc(db, 'users', userId.toString());
    await setDoc(userDocRef, {
      [historyKey]: JSON.stringify(historyData),
      lastActive: serverTimestamp()
    }, { merge: true });
    console.log(`[FIREBASE] Synced ${historyKey} successfully`);
  } catch (err) {
    console.warn(`[FIREBASE] Failed to sync ${historyKey}:`, err);
  }
}

/**
 * Fetch all users from Firestore for Admin Panel reconciliation and real-time analytics.
 */
export async function getAllUsersFromFirebase(): Promise<any[]> {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    return snap.docs.map((d) => {
      const data = d.data();
      let lastActiveMs = 0;
      if (data.lastActive) {
        if (typeof data.lastActive.toMillis === 'function') {
          lastActiveMs = data.lastActive.toMillis();
        } else if (typeof data.lastActive.seconds === 'number') {
          lastActiveMs = data.lastActive.seconds * 1000;
        } else if (typeof data.lastActive === 'number') {
          lastActiveMs = data.lastActive;
        }
      }
      return {
        ...data,
        id: (data.id || d.id).toString(),
        lastActiveMs
      };
    });
  } catch (err) {
    console.warn('[FIREBASE] Failed to fetch all users for admin:', err);
    return [];
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

