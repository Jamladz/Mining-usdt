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

    if (referrerId === currentUserId) {
      return { success: false, message: 'You cannot refer yourself!' };
    }

    try {
      const initData = window.Telegram?.WebApp?.initData || 'mock_init_data';
      const res = await fetch('/api/referrals/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        },
        body: JSON.stringify({ start_param: startParam })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to process referral' };
      }
      return data;
    } catch (err) {
      console.error('[referralService] Failed to process referral via backend:', err);
      return { success: false, message: 'Failed to register referral relationship' };
    }
  },

  /**
   * Claims milestone rewards
   */
  async claimMilestone(userId: string, target: number): Promise<{ success: boolean; rewardUSDT: number; rewardMiningRate: number; message: string }> {
    try {
      const initData = window.Telegram?.WebApp?.initData || 'mock_init_data';
      const res = await fetch('/api/referrals/claim-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: data.error || 'Failed to claim milestone' };
      }
      return {
        success: true,
        rewardUSDT: data.rewardUSDT,
        rewardMiningRate: data.rewardMiningRate,
        message: data.message
      };
    } catch (err) {
      console.error(err);
      return { success: false, rewardUSDT: 0, rewardMiningRate: 0, message: 'Failed to claim milestone' };
    }
  }
};
