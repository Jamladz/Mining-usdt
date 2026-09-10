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
  { target: 3, rewardUSDTUnits: 3000, rewardMiningUnits: 100, description: 'Refer 3 friends and claim +0.30 USDT reward!' },
  { target: 6, rewardUSDTUnits: 6000, rewardMiningUnits: 200, description: 'Refer 6 friends and claim +0.60 USDT reward!' },
  { target: 9, rewardUSDTUnits: 9000, rewardMiningUnits: 300, description: 'Refer 9 friends and claim +0.90 USDT reward!' },
  { target: 12, rewardUSDTUnits: 12000, rewardMiningUnits: 400, description: 'Refer 12 friends and claim +1.20 USDT reward!' },
  { target: 15, rewardUSDTUnits: 15000, rewardMiningUnits: 500, description: 'Refer 15 friends and claim +1.50 USDT reward!' },
  { target: 18, rewardUSDTUnits: 18000, rewardMiningUnits: 600, description: 'Refer 18 friends and claim +1.80 USDT reward!' },
  { target: 21, rewardUSDTUnits: 21000, rewardMiningUnits: 700, description: 'Refer 21 friends and claim +2.10 USDT reward!' },
  { target: 24, rewardUSDTUnits: 24000, rewardMiningUnits: 800, description: 'Refer 24 friends and claim +2.40 USDT reward!' },
  { target: 27, rewardUSDTUnits: 27000, rewardMiningUnits: 900, description: 'Refer 27 friends and claim +2.70 USDT reward!' },
  { target: 30, rewardUSDTUnits: 30000, rewardMiningUnits: 1000, description: 'Refer 30 friends and claim +3.00 USDT reward!' }
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

      // Query live referrals collection to get the most accurate, real-time count
      let realCount = 0;
      try {
        const q = query(
          collection(db, 'referrals'),
          where('referrerId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        realCount = querySnapshot.size;
      } catch (e) {
        console.warn('Failed to fetch live referrals count, falling back to profile field', e);
      }

      const referralsCount = Math.max(userData.referralsCount || 0, realCount);
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
