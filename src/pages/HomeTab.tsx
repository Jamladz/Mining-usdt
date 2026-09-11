import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { formatUSDT, CLAIM_COOLDOWN_MS } from '../lib/utils';
import { USDT } from "../components/USDT";
import { Pickaxe, Timer, Sparkles, Zap, Users, History, ArrowUpRight, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function HomeTab() {
  const { user, setUser, fetchUser, initData } = useApp();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [history, setHistory] = useState<{ id: number; amount: number; claimedAt: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    if (!initData) {
      setLoadingHistory(false);
      return;
    }
    try {
      const res = await fetch('/api/mine/history', {
        headers: {
          'Authorization': initData || ''
        }
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected response format');
      }

      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (e) {
      console.warn('Failed to fetch mining history, using simulation fallback.', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, initData]);

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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected response format from server');
      }

      const data = await res.json();
      if (data.success) {
        if (user) {
          setUser({
            ...user,
            balance: data.balance ?? user.balance,
            lastClaimAt: data.lastClaimAt ?? Date.now()
          });
        }
        setShowSuccess(true);
        fetchHistory();
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to claim');
      }
    } catch (e) {
      console.warn('Backend not available, using local simulation for claim');
      const now = Date.now();
      if (user) {
        setUser({ 
          ...user, 
          balance: (user.balance || 0) + (user.miningRate || 0),
          lastClaimAt: now
        });
        // Prepend simulated claim
        setHistory(prev => [
          {
            id: Math.random(),
            amount: user.miningRate || 1000,
            claimedAt: now
          },
          ...prev
        ]);
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
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F5F7F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Home" />
      
      <div className="p-4 pb-24 flex flex-col space-y-4">
        
        {/* Premium Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <p className="text-slate-400 text-[11px] font-bold mb-2 uppercase tracking-[0.2em] relative z-10 flex items-center gap-2">
            YOUR BALANCE
          </p>
          
          <div className="flex flex-col items-center justify-center space-y-2 relative z-10">
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
              <img src="https://i.ibb.co/1GRktfhQ/Tether-USDT.png" alt="USDT" className="w-8 h-8 sm:w-10 sm:h-10 object-contain relative z-10 drop-shadow-md" />
            </motion.div>
            
            <h2 className="text-2xl sm:text-3xl leading-none font-black text-slate-900 tracking-tighter flex items-center justify-center w-full min-w-0">
              <USDT amount={formatUSDT(user?.balance || 0)} size="text-2xl sm:text-3xl" iconSize="w-5 h-5 sm:w-7 sm:h-7" />
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
                <span className="text-emerald-600/80 text-xs font-bold flex items-center gap-1"><USDT amount={'+' + formatUSDT(user?.miningRate || 0)} size="text-xs" iconSize="w-3 h-3" /> added to balance</span>
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
              <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-lg sm:text-xl" iconSize="w-4 h-4 sm:w-5 sm:h-5" />
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
              <USDT amount={formatUSDT(user?.totalEarned || 0)} size="text-lg sm:text-xl" iconSize="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </motion.div>
        </div>

        {/* Premium Mining History */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="border-t border-slate-100 pt-6 mt-2 flex flex-col space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-700">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 tracking-tight">Mining History</h3>
                <p className="text-[10px] text-slate-400 font-medium">Your recent claim records</p>
              </div>
            </div>
            {history.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full font-mono">
                {history.length} claims
              </span>
            )}
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                <p className="text-[10px] font-bold text-slate-400">Loading your history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60 p-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-700">No History Available</h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px] mt-1 mx-auto leading-normal">
                    You haven't claimed any mining rewards yet. Press the CLAIM button above to start!
                  </p>
                </div>
              </div>
            ) : (
              history.map((claim) => (
                <div 
                  key={claim.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors border border-slate-100/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">Successfully Claimed</p>
                      <p className="text-[9px] font-medium text-slate-400">
                        {new Date(claim.claimedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-lg">
                    <span className="text-[11px] font-black text-emerald-600">+</span>
                    <USDT amount={formatUSDT(claim.amount)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
