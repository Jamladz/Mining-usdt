import { ReferralMilestone } from '../types';

export const WELCOME_REFERRAL_REWARD = 100;
export const REFERRER_REWARD = 250;

export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { id: 'm1', targetCount: 3, rewardCoins: 500, rewardVipDays: 1 },
  { id: 'm2', targetCount: 5, rewardCoins: 1000, rewardVipDays: 3 },
  { id: 'm3', targetCount: 10, rewardCoins: 2500, rewardVipDays: 7 },
  { id: 'm4', targetCount: 25, rewardCoins: 7000, rewardVipDays: 30 },
];
