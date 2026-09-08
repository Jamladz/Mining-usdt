export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredId: string;
  referredName?: string;
  rewardCoins: number;
  createdAt: number;
}

export interface ReferralMilestone {
  id: string;
  targetCount: number;
  rewardCoins: number;
  rewardVipDays?: number;
}

export interface User {
  id: string;
  username: string;
  firstName: string;
  photoUrl: string;
  balance: number;
  totalEarned: number;
  miningRate: number;
  referralCode: string;
  referredBy?: string;
  referralsCount: number;
  earnedReferralCoins: number;
  claimedMilestones: string[];
  lastClaimAt?: number;
  createdAt: number;
}
