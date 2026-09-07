import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Gift } from 'lucide-react';
import { USDT } from './USDT';

export function WelcomeClaimSheet() {
  const { user, setUser, initData } = useApp();
  const [isClaiming, setIsClaiming] = useState(false);

  if (!user) return null;

  let claimed: string[] = [];
  try {
    claimed = JSON.parse(user.claimedMilestones || '[]');
  } catch (e) {}

  const hasUnclaimedWelcome = user.referredBy && !claimed.includes('welcome_claimed');

  const handleClaim = async () => {
    if (isClaiming) return;
    setIsClaiming(true);

    try {
      const res = await fetch('/api/referrals/claim-welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        }
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser({
          ...data.user,
          referralsCount: user.referralsCount,
          referralBonusEarned: user.referralBonusEarned
        });
      }
    } catch (err) {
      console.error('Failed to claim welcome bonus:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      {hasUnclaimedWelcome && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Bottom Sheet - 30% height */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-50 flex flex-col justify-between"
            style={{ height: '32%', minHeight: '260px' }}
          >
            {/* Top notch indicator */}
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

            <div className="flex flex-col items-center text-center space-y-3 flex-1 justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-100 blur-xl opacity-50 rounded-full animate-pulse"></div>
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 relative z-10">
                  <Gift className="w-6 h-6" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center justify-center gap-1.5">
                  Welcome Gift! <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">You received a referral bonus for joining</p>
              </div>

              <div className="flex items-center justify-center bg-slate-50 py-2 px-4 rounded-2xl border border-slate-100 shadow-sm">
                <USDT amount="0.7000" size="text-2xl" iconSize="w-6 h-6" className="text-emerald-600 font-black" />
              </div>
            </div>

            <div className="mt-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleClaim}
                disabled={isClaiming}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-sm transition-all shadow-[0_8px_20px_rgba(15,23,42,0.15)] flex items-center justify-center gap-2"
              >
                {isClaiming ? 'Claiming...' : 'Claim 0.7 USDT'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
