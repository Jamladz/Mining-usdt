import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { ReferralRecord } from '../types/referral';

export interface Milestone {
  target: number;
  rewardUSDTUnits: number; // in scale 10000 (e.g., 5000 = 0.50 USDT)
  rewardMiningUnits: number; // in scale 10000 (e.g., 500 = +0.05 Rate)
  description: string;
}

export const REFERRAL_MILESTONES: Milestone[] = [
  { target: 3, rewardUSDTUnits: 5000, rewardMiningUnits: 500, description: 'Refer 3 friends and get +0.50 USDT & +0.05/24h Boost' },
  { target: 5, rewardUSDTUnits: 10000, rewardMiningUnits: 1000, description: 'Refer 5 friends and get +1.00 USDT & +0.10/24h Boost' },
  { target: 10, rewardUSDTUnits: 25000, rewardMiningUnits: 2500, description: 'Refer 10 friends and get +2.50 USDT & +0.25/24h Boost' },
  { target: 25, rewardUSDTUnits: 100000, rewardMiningUnits: 10000, description: 'Refer 25 friends and get +10.00 USDT & +1.00/24h Boost' }
];

export const referralService = {
  getTelegramUser() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  },

  getCurrentUserId(): string | null {
    const user = this.getTelegramUser();
    return user?.id?.toString() || null;
  },

  getReferralLink(userId: string): string {
    const botUsername = 'Miningusdt2027_bot';
    return `https://t.me/${botUsername}?startapp=ref_${userId}`;
  },

  async getShareTelegramLink(userId: string): Promise<string> {
    const url = this.getReferralLink(userId);
    const message = `🎁 Join me to mine free USDT and receive a welcome bonus!\n🚀 Click the link and start now:\n\n${url}`;
    return `https://t.me/share/url?text=${encodeURIComponent(message)}`;
  },

  /**
   * Fetches user referrals from Firestore.
   */
  async getUserReferrals(userId: string): Promise<ReferralRecord[]> {
    if (!userId) return [];
    try {
      const q = query(
        collection(db, 'referrals'),
        where('referrerId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const results: ReferralRecord[] = [];
      querySnapshot.forEach((docRef) => {
        const data = docRef.data();
        results.push({
          id: docRef.id,
          referrerId: data.referrerId,
          referredUserId: data.referredUserId,
          referredName: data.referredName || 'User',
          rewardCoins: 0,
          rewardUSDT: data.rewardUSDT || 1000, // 0.10 USDT
          miningBonus: data.miningBonus || 100, // 0.01 Boost
          status: 'completed',
          createdAt: data.createdAt || Date.now()
        });
      });
      // Sort client-side
      return results.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error('Failed fetching user referrals from Firestore:', e);
      return [];
    }
  },

  /**
   * Processes the referral deep link when user enters the application.
   */
  async processReferral(
    currentUserId: string,
    currentUserName: string,
    currentUserUsername: string
  ): Promise<{ success: boolean; rewardAmount?: number; referrerName?: string; message?: string } | null> {
    if (!currentUserId) return null;

    let startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';

    if (!startParam) {
      try {
        const urlParams = new URLSearchParams(window.location.search || window.location.hash.replace('#', '?'));
        startParam = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('start') || '';
      } catch (e) {}
    }

    if (!startParam) return null;

    const match = startParam.match(/(?:ref_|startapp_)?([0-9]+)/);
    const referrerId = match ? match[1] : null;

    if (!referrerId) return null;

    // 1. Prevent self-referral
    if (referrerId === currentUserId) {
      return { success: false, message: 'You cannot refer yourself!' };
    }

    try {
      // 2. Prevent duplicate referrals (referred only once)
      const refDocRef = doc(db, 'referrals', currentUserId);
      const refDocSnap = await getDoc(refDocRef);
      if (refDocSnap.exists()) {
        return { success: false, message: 'You have already been referred!' };
      }

      // 3. Register the referral record in Firestore باسم referrals
      await setDoc(refDocRef, {
         id: currentUserId,
         referrerId: referrerId,
         referredUserId: currentUserId,
         referredName: currentUserName,
         referredUsername: currentUserUsername || '',
         rewardUSDT: 1000, // 0.10 USDT
         miningBonus: 100, // +0.01 Rate boost
         createdAt: Date.now()
      });

      // 4. Update Referrer Profile in Firestore
      const referrerDocRef = doc(db, 'users', referrerId);
      const referrerSnap = await getDoc(referrerDocRef);
      let referrerName = 'your friend';

      if (referrerSnap.exists()) {
        const referrerData = referrerSnap.data();
        referrerName = referrerData.firstName || referrerData.username || 'your friend';

        await updateDoc(referrerDocRef, {
          referralsCount: increment(1),
          balance: increment(1000), // +0.10 USDT balance
          referralEarnings: increment(1000), // +0.10 USDT earnings
          miningRate: increment(100) // +0.01 Boost
        });
      } else {
        await setDoc(referrerDocRef, {
          id: referrerId,
          referralsCount: 1,
          balance: 1000,
          referralEarnings: 1000,
          miningRate: 1100, // base 1000 + 100 boost
          createdAt: Date.now()
        }, { merge: true });
      }

      return {
        success: true,
        rewardAmount: 1000, // 0.10 USDT
        referrerName
      };
    } catch (err) {
      console.error('[referralService] Failed to process referral:', err);
      return { success: false, message: 'Failed to register referral relationship' };
    }
  },

  /**
   * Claims milestone rewards
   */
  async claimMilestone(userId: string, target: number): Promise<{ success: boolean; rewardUSDT: number; rewardMiningRate: number; message: string }> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'User profile not found' };
      }

      const userData = userSnap.data();
      const claimed = userData.claimedMilestones || [];

      if (claimed.includes(target)) {
        return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'You have already claimed this milestone reward!' };
      }

      const referralsCount = userData.referralsCount || 0;
      if (referralsCount < target) {
        return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'You have not reached this target yet!' };
      }

      const milestone = REFERRAL_MILESTONES.find(m => m.target === target);
      if (!milestone) {
        return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'Invalid milestone stage!' };
      }

      // Update the user's claimed milestones, balance, and miningRate
      await updateDoc(userDocRef, {
        claimedMilestones: [...claimed, target],
        balance: increment(milestone.rewardUSDTUnits),
        miningRate: increment(milestone.rewardMiningUnits)
      });

      return {
        success: true,
        rewardUSDT: milestone.rewardUSDTUnits,
        rewardMiningRate: milestone.rewardMiningUnits,
        message: `Milestone Claimed! Received +${(milestone.rewardUSDTUnits / 10000).toFixed(2)} USDT and +${(milestone.rewardMiningUnits / 10000).toFixed(2)}/24h Boost!`
      };
    } catch (err) {
      console.error('[referralService] Error claiming milestone:', err);
      return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'Failed to claim milestone. Please try again later.' };
    }
  }
};
