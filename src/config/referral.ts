// Referral System Configuration
// Single source of truth for referral reward parameters

export const REFERRAL_USDT_REWARD = 0.1; // 0.10 USDT per successful referral
export const REFERRAL_MINING_BONUS = 0.01; // +0.01 Mining Rate per successful referral

// Integer scale constants for database storage (USDT_SCALE = 10000)
export const USDT_SCALE = 10000;
export const REFERRAL_USDT_REWARD_UNITS = 1000; // 0.10 * 10000 = 1000
export const REFERRAL_MINING_BONUS_UNITS = 100; // 0.01 * 10000 = 100
