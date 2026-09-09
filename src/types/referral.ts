export interface ReferralRecord {
  id: number | string;
  referrerId: string;
  referredUserId: string;
  referredName?: string;
  rewardUSDT: number; // in USDT units (e.g. 1000 = 0.10 USDT)
  rewardCoins?: number; // referral coins (e.g. 250)
  miningBonus: number; // in Mining Rate units (e.g. 100 = 0.01 Rate)
  status: string;
  createdAt: number;
}

export interface ReferralStats {
  referralsCount: number;
  referralEarnings: number;
  miningBoost: number;
}
