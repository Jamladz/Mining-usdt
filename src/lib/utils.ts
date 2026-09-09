import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const USDT_SCALE = 10000;
export const BASE_MINING_RATE = 1000; // 0.10 USDT
export const MAX_MINING_RATE = 1500; // 0.15 USDT
export const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MIN_WITHDRAWAL = 30000; // 3 USDT

export const formatUSDT = (value: number) => {
  return (value / USDT_SCALE).toFixed(4);
};

export const parseUSDT = (value: string | number) => {
  return Math.floor(Number(value) * USDT_SCALE);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isAdminUser = (user: { username?: string; id?: string | number } | null | undefined): boolean => {
  if (!user) return false;
  const username = (user.username || '').toLowerCase();
  const id = String(user.id || '');
  return username.includes('sekanedr') || username === 'dev_user' || id === '12345';
};
