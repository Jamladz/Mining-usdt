import { ReferralRecord } from '../types/referral';
import { REFERRAL_USDT_REWARD, REFERRAL_MINING_BONUS } from '../config/referral';

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
    const message = `💰 Start mining USDT for free with instant withdrawals!\n🎁 Earn +${REFERRAL_USDT_REWARD.toFixed(2)} USDT & +${REFERRAL_MINING_BONUS.toFixed(2)} Mining Rate per invited friend!\n🚀 Join using my link now:\n\n${url}`;
    return `https://t.me/share/url?text=${encodeURIComponent(message)}`;
  },

  async getUserReferrals(): Promise<ReferralRecord[]> {
    try {
      const response = await fetch('/api/referrals', {
        headers: {
          'Authorization': this.getAuthToken()
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.referrals || [];
    } catch (e) {
      console.error('Failed fetching user referrals:', e);
      return [];
    }
  },

  getAuthToken(): string {
    return window.Telegram?.WebApp?.initData || '';
  }
};
