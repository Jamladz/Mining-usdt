export * from './types/referral';

export interface User {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  balance: number; // scaled by 10000 (0.10 USDT = 1000)
  totalEarned: number;
  totalWithdrawn?: number;
  miningRate: number; // base 1000 = 0.10 USDT/day
  referralCode: string;
  referredBy?: string | null;
  referralsCount: number;
  referralEarnings: number; // scaled by 10000 (0.10 USDT per referral = 1000)
  earnedReferralCoins: number; // in referral coins (250 coins per referral)
  claimedMilestones?: number[];
  lastClaimAt?: number;
  claimedWelcome?: number;
  createdAt: number;
  completedTasks?: string;
}
