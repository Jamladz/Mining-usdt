import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { formatUSDT, CLAIM_COOLDOWN_MS } from '../lib/utils';
import { USDT } from "../components/USDT";
import { Pickaxe, Timer, Sparkles, Zap, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function HomeTab() {
  const { user, setUser, fetchUser, initData } = useApp();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const nextClaim = (user.lastClaimAt || 0) + CLAIM_COOLDOWN_MS;
      if (now < nextClaim) {
        setTimeLeft(nextClaim - now);
      } else {
        setTimeLeft(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user]);

  const handleClaim = async () => {
    if (isClaiming || timeLeft > 0) return;
    setIsClaiming(true);
    
    try {
      const res = await fetch('/api/mine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        }
      });
      const data = await res.json();
      if (data.success) {
        await fetchUser();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to claim');
      }
    } catch (e) {
      console.warn('Backend not available, using local simulation for claim');
      // Simulate claim locally for demo/static environments
      if (user) {
        setUser({ ...user, balance: (user.balance || 0) + (user.miningRate || 0) });
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsClaiming(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = timeLeft > 0 ? 100 - (timeLeft / CLAIM_COOLDOWN_MS) * 100 : 100;

  return (
    <div className="flex flex-col h-full bg-[#F5F7F9]">
      <Header title="Home" />
      
      <div className="p-4 flex flex-col space-y-4">
        
        {/* Premium Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <p className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-[0.2em] relative z-10 flex items-center gap-2">
            YOUR BALANCE
          </p>
          
          <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
            <motion.div
              animate={{ 
                y: [0, -3, 0],
                rotate: [0, -2, 2, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 rounded-full"></div>
              <img src="https://i.ibb.co/1GRktfhQ/Tether-USDT.png" alt="USDT" className="w-10 h-10 object-contain relative z-10 drop-shadow-md" />
            </motion.div>
            
            <h2 className="text-3xl sm:text-4xl leading-none font-black text-slate-900 tracking-tighter flex items-center justify-center w-full min-w-0">
              <USDT amount={formatUSDT(user?.balance || 0)} size="text-3xl sm:text-4xl" iconSize="w-6 h-6 sm:w-8 sm:h-8" className="truncate" />
            </h2>
          </div>
        </motion.div>

        {/* Premium Mining CTA Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col relative"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Pickaxe className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-900 tracking-tight">Free Mining</h3>
                <p className="text-[12px] text-slate-500 font-medium flex items-center gap-1">Earn <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-[12px]" iconSize="w-3 h-3" />/24h</p>
              </div>
            </div>
            {timeLeft > 0 && (
              <div className="bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100 flex flex-col items-end">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Next Claim</span>
                <p className="text-xs font-black font-mono text-emerald-600">{formatTime(timeLeft)}</p>
              </div>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full py-4 bg-emerald-50 rounded-2xl flex flex-col items-center justify-center border border-emerald-100 gap-1"
              >
                <Sparkles className="w-6 h-6 text-emerald-500 mb-1" />
                <span className="text-emerald-700 font-black tracking-tight">REWARD CLAIMED</span>
                <span className="text-emerald-600/80 text-xs font-bold flex items-center gap-1">+{formatUSDT(user?.miningRate || 0)} <USDT size="text-xs" iconSize="w-3 h-3" /> added to balance</span>
              </motion.div>
            ) : timeLeft > 0 ? (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
                <button disabled className="w-full py-3 bg-slate-50 text-slate-400 font-black rounded-xl text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-slate-100 transition-all">
                  <Timer className="w-4 h-4" />
                  CLAIM UNAVAILABLE
                </button>
              </motion.div>
            ) : (
              <motion.button 
                key="claim"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleClaim}
                disabled={isClaiming}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-slate-900 text-white hover:bg-slate-800 font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                <Pickaxe className="w-4 h-4" />
                {isClaiming ? 'PROCESSING...' : <span className="flex items-center gap-1">CLAIM <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-sm text-white" iconSize="w-4 h-4" /></span>}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Premium Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mining Rate</p>
            </div>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-lg sm:text-xl" iconSize="w-4 h-4 sm:w-5 sm:h-5" className="truncate" />
              <span className="text-[10px] font-bold text-slate-400 mb-0.5 shrink-0">/24h</span>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Earned</p>
            </div>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.totalEarned || 0)} size="text-lg sm:text-xl" iconSize="w-4 h-4 sm:w-5 sm:h-5" className="truncate" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
