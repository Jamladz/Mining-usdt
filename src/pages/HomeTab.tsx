import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { formatUSDT, CLAIM_COOLDOWN_MS } from '../lib/utils';
import { USDT } from "../components/USDT";
import { Pickaxe, Timer, Sparkles, Zap, Users, History, ArrowUpRight, Loader2, Clock, CheckCircle2, ShieldCheck, Gift, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncHistoryToFirebase } from '../lib/firebase';
import { LiveWithdrawals } from '../components/LiveWithdrawals';

interface HomeTabProps {
  onNavigateToTask?: (taskId: string) => void;
}

export function HomeTab({ onNavigateToTask }: HomeTabProps) {
  const { user, setUser, fetchUser, initData, showToast } = useApp();
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
        if (user?.id) {
          syncHistoryToFirebase(user.id, 'miningClaimsHistory', data.history);
        }
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
        showToast(data.error || 'Failed to claim', 'error');
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

  // Check if the user has an uncompleted 0.50 USDT one-time task
  const featuredHalfUsdtTask = React.useMemo(() => {
    const completedIds = new Set<string>();
    if (user?.completedTasks) {
      try {
        const parsed = JSON.parse(user.completedTasks);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            const id = typeof item === 'string' ? item : item?.taskId;
            if (id) completedIds.add(id);
          });
        }
      } catch (e) {
        // ignore parse error
      }
    }

    if (!completedIds.has('sys_join_riftycoin')) {
      return {
        id: 'sys_join_riftycoin',
        title: 'Join RiftyCoin Bot',
        reward: '0.50'
      };
    }
    if (!completedIds.has('sys_join_walt')) {
      return {
        id: 'sys_join_walt',
        title: 'Join Walt',
        reward: '0.50'
      };
    }
    return null;
  }, [user?.completedTasks]);

  const handleOpenFeaturedTask = () => {
    if (!featuredHalfUsdtTask) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (e) {}
    }
    onNavigateToTask?.(featuredHalfUsdtTask.id);
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F4F6F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Home" />
      
      <div className="p-4 pb-28 flex flex-col space-y-4 max-w-md mx-auto">

        {/* Delightful One-Time 0.50 USDT Task Notification Banner */}
        <AnimatePresence>
          {featuredHalfUsdtTask && (
            <motion.button
              key={featuredHalfUsdtTask.id}
              type="button"
              onClick={handleOpenFeaturedTask}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.94, height: 0, marginBottom: 0 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="w-full text-left relative overflow-hidden rounded-[24px] p-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-[0_12px_28px_-6px_rgba(16,185,129,0.4)] border border-emerald-300/40 flex items-center justify-between gap-3 group cursor-pointer"
            >
              {/* Soft shimmer / ambient glow */}
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 left-8 w-24 h-24 bg-amber-300/20 rounded-full blur-xl pointer-events-none" />

              <div className="relative z-10 flex items-center gap-3 min-w-0">
                <motion.div
                  animate={{ y: [0, -2.5, 0], rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 shadow-inner relative"
                >
                  <Gift className="w-5 h-5 text-white drop-shadow-xs" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                  </span>
                </motion.div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-50">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
                      <span>Special Bonus Mission</span>
                    </span>
                    <span className="text-white/50 text-[10px]">·</span>
                    <span className="text-[10px] font-bold text-emerald-100">One-Time</span>
                  </div>

                  <p className="text-[13px] font-black text-white tracking-tight truncate mt-0.5">
                    {featuredHalfUsdtTask.title} & Claim Gift!
                  </p>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-50 mt-0.5">
                    <span>Instant Boost:</span>
                    <span className="bg-slate-950/25 px-1.5 py-0.5 rounded-lg inline-flex items-center font-mono tabular-nums text-white font-black">
                      <USDT amount={`+${featuredHalfUsdtTask.reward}`} size="text-[11px] text-white" iconSize="w-3.5 h-3.5" />
                      <span className="text-[9px] text-emerald-100 ml-0.5">/24h</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 shrink-0 flex items-center gap-1 bg-white text-emerald-950 font-black text-[11px] px-3 py-2 rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                <span>Open</span>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
              </div>
            </motion.button>
          )}
        </AnimatePresence>
        
        {/* Executive Balance & Portfolio Vault Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[28px] p-5 text-white shadow-[0_14px_35px_rgba(15,23,42,0.16)] relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-12 w-44 h-44 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-300 tracking-wide">
              Available Portfolio Balance
            </span>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>USDT Vault</span>
            </span>
          </div>
          
          <div className="relative z-10 my-2">
            <h2 className="text-3xl sm:text-4xl leading-none font-black text-white tracking-tight font-mono tabular-nums">
              <USDT amount={formatUSDT(user?.balance || 0)} size="text-3xl sm:text-4xl text-white" iconSize="w-8 h-8 sm:w-9 sm:h-9" />
            </h2>
            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
              Updated automatically after every mining session
            </p>
          </div>

          {/* Integrated Telemetry Strip */}
          <div className="relative z-10 mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/15 flex items-center justify-center text-amber-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-slate-400 block">Mining Rate</span>
                <div className="text-xs font-black text-white font-mono tabular-nums flex items-center gap-1">
                  <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-xs text-white" iconSize="w-4 h-4" />
                  <span className="text-[10px] font-semibold text-slate-400">/24h</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-l border-white/10 pl-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/15 flex items-center justify-center text-emerald-400 shrink-0">
                <Pickaxe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-slate-400 block">Total Mined</span>
                <div className="text-xs font-black text-white font-mono tabular-nums flex items-center gap-1">
                  <USDT amount={formatUSDT(user?.totalEarned || 0)} size="text-xs text-white" iconSize="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Cloud Mining Engine Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white p-5 rounded-[28px] shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70 flex flex-col relative"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Pickaxe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-[15px] text-slate-900 tracking-tight">Daily Cloud Mining</h3>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <span>Yields</span>
                  <span className="font-mono tabular-nums font-bold text-slate-800">
                    <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-xs" iconSize="w-3.5 h-3.5" />
                  </span>
                  <span>per 24h cycle</span>
                </p>
              </div>
            </div>

            {timeLeft > 0 ? (
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 block">Next Claim</span>
                <p className="text-xs font-black font-mono tabular-nums text-emerald-600 mt-0.5">
                  {formatTime(timeLeft)}
                </p>
              </div>
            ) : (
              <span className="text-xs font-bold text-emerald-600">
                Ready
              </span>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full py-4 bg-emerald-50/80 rounded-2xl flex flex-col items-center justify-center border border-emerald-200/70 gap-1"
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-0.5" />
                <span className="text-emerald-900 text-xs font-black tracking-tight">Mining Reward Claimed</span>
                <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1 font-mono tabular-nums">
                  <USDT amount={'+' + formatUSDT(user?.miningRate || 0)} size="text-[11px]" iconSize="w-3.5 h-3.5" /> added to your balance
                </span>
              </motion.div>
            ) : timeLeft > 0 ? (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 font-mono tabular-nums">
                    <span>Session Progress</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-700" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <button
                  disabled
                  className="w-full h-12 bg-slate-100 text-slate-400 font-black rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200/80 transition-all"
                >
                  <Timer className="w-4 h-4" />
                  <span>Mining in Progress ({formatTime(timeLeft)})</span>
                </button>
              </motion.div>
            ) : (
              <motion.button 
                key="claim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClaim}
                disabled={isClaiming}
                whileTap={{ scale: 0.98 }}
                className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
              >
                <Pickaxe className="w-4 h-4 text-emerald-400" />
                {isClaiming ? (
                  <span>Claiming Reward...</span>
                ) : (
                  <span className="flex items-center gap-1.5 font-mono tabular-nums">
                    <span>Claim</span>
                    <USDT amount={formatUSDT(user?.miningRate || 0)} size="text-xs text-white" iconSize="w-4 h-4" />
                  </span>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Live Withdrawals Feed */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <LiveWithdrawals />
        </motion.div>

        {/* Recent Claim Records Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[28px] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70 flex flex-col space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 tracking-tight">Recent Claim Records</h3>
                <p className="text-[10px] text-slate-400 font-medium">Completed 24-hour mining sessions</p>
              </div>
            </div>
            {history.length > 0 && (
              <span className="text-[11px] text-slate-400 font-bold font-mono tabular-nums">
                {history.length} {history.length === 1 ? 'claim' : 'claims'}
              </span>
            )}
          </div>

          <div className="max-h-[260px] overflow-y-auto pr-0.5">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-400">Loading claim history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-4">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">No mining claims yet</h4>
                  <p className="text-[11px] text-slate-400 max-w-[220px] mt-0.5 mx-auto leading-normal">
                    Claim your first daily reward above to start building your mining ledger.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((claim) => (
                  <div 
                    key={claim.id} 
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">Mining Reward Claimed</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
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
                    <div className="flex items-center gap-0.5 font-mono tabular-nums shrink-0">
                      <span className="text-xs font-black text-emerald-600">+</span>
                      <USDT amount={formatUSDT(claim.amount)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

