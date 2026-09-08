import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { USDT } from './USDT';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Gift, Loader2 } from 'lucide-react';

export function WelcomeBonusSheet() {
  const { user, setUser, initData, showToast, isAuthCompleted } = useApp();
  const [claiming, setClaiming] = useState(false);

  // Show only if user exists, auth is complete, and welcome bonus has NOT been claimed yet
  const shouldShow = user && isAuthCompleted && (!user.claimedWelcome || user.claimedWelcome === 0);

  const handleClaim = async () => {
    if (!initData || claiming) return;
    setClaiming(true);

    try {
      const res = await fetch('/api/welcome/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        }
      });

      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        showToast(
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-black text-amber-200">🎉 Welcome Bonus Claimed!</span>
            <span className="text-[11px] font-bold text-white opacity-90">+0.50 USDT has been added to your balance.</span>
          </div>,
          'success'
        );
      } else {
        showToast(data.error || 'Failed to claim welcome bonus', 'error');
      }
    } catch (e) {
      console.error('Error claiming welcome bonus:', e);
      showToast('Connection error while claiming bonus', 'error');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-md">
          {/* Bottom Sheet Container sliding from bottom to top */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-full max-w-md bg-white rounded-t-[36px] p-6 shadow-2xl border-t border-slate-100 flex flex-col items-center text-center space-y-5 relative overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Drag handle pill */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />

            {/* Icon Header */}
            <div className="relative mt-2">
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/25 flex items-center justify-center"
              >
                <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center text-emerald-400">
                  <Gift className="w-10 h-10" />
                </div>
              </motion.div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-md">
                <Sparkles className="w-4 h-4 fill-slate-950" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="space-y-1.5 px-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome Bonus!</h2>
              <p className="text-xs font-bold text-slate-500 leading-relaxed max-w-xs mx-auto">
                Welcome to <strong className="text-slate-900">USDT Miner</strong>! Here is an exclusive welcome gift to start earning real crypto instantly.
              </p>
            </div>

            {/* Bonus Box showing USDT Logo directly in front of 0.5 */}
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl py-4 px-6 flex items-center justify-center gap-3 shadow-inner my-1">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Reward:</span>
              <USDT amount="0.5 USDT" size="text-3xl font-black text-slate-900" iconSize="w-8 h-8" />
            </div>

            {/* Claim Button in English */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 transition-all border border-slate-800 disabled:opacity-75"
            >
              {claiming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Claiming...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>Claim</span>
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
