import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const userService = {
  /**
   * Initializes user referral data like referralsCount and earnedReferralCoins from Firestore.
   */
  async initializeUserReferralData(userId: string): Promise<{ referralsCount: number; earnedReferralCoins: number }> {
    if (!userId) return { referralsCount: 0, earnedReferralCoins: 0 };
    try {
      const userDocRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          referralsCount: typeof data.referralsCount === 'number' ? data.referralsCount : 0,
          earnedReferralCoins: typeof data.earnedReferralCoins === 'number' ? data.earnedReferralCoins : 0,
        };
      }
      return { referralsCount: 0, earnedReferralCoins: 0 };
    } catch (err) {
      console.error('[userService] Error initializing user referral data:', err);
      return { referralsCount: 0, earnedReferralCoins: 0 };
    }
  }
};
