import { ReferralRecord } from '../types';

export const referralService = {
  getTelegramUser() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  },

  getCurrentUserId() {
    const user = this.getTelegramUser();
    return user?.id?.toString() || null;
  },

  getReferralLink(userId: string) {
    const botUsername = 'USDT_Miner_Mining_Bot'; // Replace with actual bot username
    return `https://t.me/${botUsername}?startapp=ref_${userId}`;
  },

  async getShareTelegramLink(userId: string) {
    const url = this.getReferralLink(userId);
    const text = "💰 Start mining USDT for free with instant withdrawals!\n🎁 Get a 0.7 USDT instant welcome bonus when you register using my link!\n🚀 Click the link and start earning now:";
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  },

  async processReferral(startParam?: string) {
    // This logic is mostly handled server-side during auth, 
    // but we call the auth endpoint which triggers processReferral on the backend.
    // The startParam is sent in the body of /api/auth
  },

  async getUserReferrals(): Promise<ReferralRecord[]> {
    const response = await fetch('/api/referrals', {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.referrals || [];
  },

  async getReferralLeaderboard() {
    const response = await fetch('/api/referrals/leaderboard', {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.leaderboard || [];
  },

  async claimReferralMilestone(milestoneId: string) {
    const response = await fetch('/api/referrals/claim-milestone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ milestoneId })
    });
    return response.json();
  },

  getAuthToken() {
    return window.Telegram?.WebApp?.initData || '';
  }
};
