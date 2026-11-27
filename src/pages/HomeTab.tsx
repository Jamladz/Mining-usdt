import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { formatUSDT, CLAIM_COOLDOWN_MS } from '../lib/utils';
import { USDT } from "../components/USDT";
import { Pickaxe, Timer, Sparkles, Zap, Users, History, ArrowUpRight, Loader2, Clock, CheckCircle2, ShieldCheck, Gift, ChevronRight, Wallet, Lock, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncHistoryToFirebase, syncUserToFirebase } from '../lib/firebase';
import { LiveWithdrawals } from '../components/LiveWithdrawals';
import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { cn } from '../lib/utils';

interface HomeTabProps {
  onNavigateToTask?: (taskId: string) => void;
}

export function HomeTab({ onNavigateToTask }: HomeTabProps) {
  const { user, setUser, fetchUser, initData, showToast } = useApp();
  const [tonConnectUI] = useTonConnectUI();
  const currentTonAddress = useTonAddress();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [history, setHistory] = useState<{ id: number; amount: number; claimedAt: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isVerifyingBonusTask, setIsVerifyingBonusTask] = useState(false);
  const [bonusCountdown, setBonusCountdown] = useState<number>(0);
  const [showVerificationSheet, setShowVerificationSheet] = useState(false);
  const [isVerifyingTon, setIsVerifyingTon] = useState(false);

  const isMiningVerified = Boolean(user?.miningVerified && user.miningVerified >= 1);

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

  const executeClaim = async (bypassVerificationState = false) => {
    if (isClaiming || timeLeft > 0) return;
    if (!isMiningVerified && !bypassVerificationState) {
      setShowVerificationSheet(true);
      return;
    }

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
        if (res.status === 403 || errData.code === 'VERIFICATION_REQUIRED') {
          setShowVerificationSheet(true);
          return;
        }
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected response format from server');
      }

      const data = await res.json();
      if (data.success) {
        if (user) {
          const nextUser = {
            ...user,
            miningVerified: 1,
            balance: data.balance ?? user.balance,
            lastClaimAt: data.lastClaimAt ?? Date.now()
          };
          setUser(nextUser);
          syncUserToFirebase(nextUser);
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
        const nextUser = { 
          ...user, 
          miningVerified: 1,
          balance: (user.balance || 0) + (user.miningRate || 0),
          lastClaimAt: now
        };
        setUser(nextUser);
        syncUserToFirebase(nextUser);
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

  const handleClaim = () => {
    if (!isMiningVerified) {
      setShowVerificationSheet(true);
      return;
    }
    executeClaim(true);
  };

  const handleVerifyMiningWithTon = async () => {
    if (!currentTonAddress) {
      try {
        await tonConnectUI.openModal();
      } catch (e) {
        showToast('Please connect your TON wallet first using the Connect button above.', 'error');
      }
      return;
    }

    setIsVerifyingTon(true);
    try {
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        messages: [
          {
            address: 'UQCTZAMbXoN5T43K9gJXH8GYWBmIstXrUrdoV9kv3btN1Ad3',
            amount: Math.round(0.05 * 1000000000).toString() // 0.05 TON in nanotons (50,000,000)
          }
        ]
      };

      await tonConnectUI.sendTransaction(transaction);

      const res = await fetch('/api/verify-mining', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        }
      });

      const data = await res.json().catch(() => ({}));
      const verifiedUser = data?.user
        ? { ...data.user, miningVerified: 1 }
        : user
          ? { ...user, miningVerified: 1 }
          : null;

      if (verifiedUser) {
        setUser(verifiedUser);
        syncUserToFirebase(verifiedUser);
      }

      setShowVerificationSheet(false);
      showToast(
        <div className="flex flex-col gap-0.5 text-left" dir="ltr">
          <span className="text-[13px] font-black text-emerald-200">🎉 Mining Node Verified!</span>
          <span className="text-[11px] font-bold text-white opacity-90">
            One-time 0.05 TON verification complete. Cloud mining is now permanently activated!
          </span>
        </div>,
        'success'
      );

      // Automatically trigger mining claim if cooldown is ready
      if (timeLeft <= 0) {
        setTimeout(() => {
          executeClaim(true);
        }, 300);
      }
    } catch (err: any) {
      console.error('TON mining verification failed:', err);
      showToast(err?.message || 'Verification transaction was canceled or failed. Please try again.', 'error');
    } finally {
      setIsVerifyingTon(false);
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

  // Check if the user has completed the Special Bonus Mission (0.50 USDT one-time task)
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

    if (!completedIds.has('sys_join_tonnel')) {
      return {
        id: 'sys_join_tonnel',
        title: 'Join Tonnel Network',
        reward: '0.50',
        link: 'https://t.me/TonnelNetworkGameBot/app?startapp=1368899842'
      };
    }
    return null;
  }, [user?.completedTasks]);

  const completeBonusMission = async (taskId: string) => {
    const completionObj = { taskId, completedAt: Date.now() };
    let existingList: { taskId: string; completedAt: number }[] = [];
    if (user?.completedTasks) {
      try {
        const parsed = JSON.parse(user.completedTasks);
        if (Array.isArray(parsed)) {
          existingList = parsed.map((item: any) =>
            typeof item === 'string' ? { taskId: item, completedAt: Date.now() } : item
          );
        }
      } catch (e) {}
    }
    const updatedList = [...existingList.filter(c => c.taskId !== taskId), completionObj];

    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ taskId, provider: 'system' })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (user) {
          setUser({
            ...user,
            miningRate: data.newRate || (user.miningRate || 0) + 5000,
            completedTasks: JSON.stringify(updatedList)
          });
        }
        await fetchUser();
        showToast('🎉 Special Bonus Mission completed! Boosted rate by +0.50 USDT/day.', 'success');
      } else {
        throw new Error(data.error || 'Fallback completion');
      }
    } catch (e) {
      if (user) {
        setUser({
          ...user,
          miningRate: (user.miningRate || 0) + 5000,
          completedTasks: JSON.stringify(updatedList)
        });
      }
      showToast('🎉 Special Bonus Mission completed! Boosted rate by +0.50 USDT/day.', 'success');
    } finally {
      setIsVerifyingBonusTask(false);
      setBonusCountdown(0);
    }
  };

  const handleOpenFeaturedTask = () => {
    if (!featuredHalfUsdtTask || isVerifyingBonusTask) return;

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (e) {}
    }

    // 1. Open the task link directly
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(featuredHalfUsdtTask.link);
    } else {
      window.open(featuredHalfUsdtTask.link, '_blank');
    }

    // 2. Start 10-second verification timer and complete automatically after 10 seconds
    const taskId = featuredHalfUsdtTask.id;
    setIsVerifyingBonusTask(true);
    setBonusCountdown(10);

    const countdownInterval = setInterval(() => {
      setBonusCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimeout(() => {
      clearInterval(countdownInterval);
      completeBonusMission(taskId);
    }, 10000);
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
              disabled={isVerifyingBonusTask}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.94, height: 0, marginBottom: 0 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="w-full text-left relative overflow-hidden rounded-[24px] p-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-[0_12px_28px_-6px_rgba(16,185,129,0.4)] border border-emerald-300/40 flex items-center justify-between gap-3 group cursor-pointer disabled:opacity-95"
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

              <div className="relative z-10 shrink-0 flex items-center gap-1.5 bg-white text-emerald-950 font-black text-[11px] px-3.5 py-2 rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors font-mono tabular-nums">
                {isVerifyingBonusTask ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                    <span>{bonusCountdown > 0 ? `${bonusCountdown}s` : '...'}</span>
                  </>
                ) : (
                  <>
                    <span className="font-sans">Open</span>
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                  </>
                )}
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

            {!isMiningVerified ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                <Lock className="w-3 h-3" />
                <span>Verification Required</span>
              </span>
            ) : timeLeft > 0 ? (
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 block">Next Claim</span>
                <p className="text-xs font-black font-mono tabular-nums text-emerald-600 mt-0.5">
                  {formatTime(timeLeft)}
                </p>
              </div>
            ) : (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready</span>
              </span>
            )}
          </div>

          {/* One-Time Wallet & 0.05 TON Verification Status Notice (if not verified yet) */}
          {!isMiningVerified && (
            <div
              onClick={() => setShowVerificationSheet(true)}
              className="mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-900">
                    <span>One-Time Node Verification</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-amber-600">0.05 TON</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                    {currentTonAddress
                      ? `Wallet connected (${currentTonAddress.slice(0, 4)}...${currentTonAddress.slice(-4)}) — Tap to verify`
                      : 'Connect TON wallet & verify once to start mining'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0 shadow-2xs">
                Verify
              </span>
            </div>
          )}
          
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
            ) : !isMiningVerified ? (
              <motion.button
                key="verify-first"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowVerificationSheet(true)}
                whileTap={{ scale: 0.98 }}
                className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Connect Wallet & Verify (0.05 TON) to Start Mining</span>
              </motion.button>
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
                    <span>Start & Claim</span>
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

      {/* Executive One-Time 0.05 TON Mining Verification Bottom Sheet */}
      <AnimatePresence>
        {showVerificationSheet && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => !isVerifyingTon && setShowVerificationSheet(false)} />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="w-full max-w-md bg-white rounded-t-[32px] p-6 pb-9 sm:pb-6 shadow-2xl border-t border-slate-100 flex flex-col relative z-10 overflow-hidden"
            >
              {/* Grab Handle */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 shrink-0" />

              {/* Close Button */}
              <button
                type="button"
                disabled={isVerifyingTon}
                onClick={() => setShowVerificationSheet(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-emerald-400 flex items-center justify-center shadow-lg mb-3 relative border border-slate-700">
                  <ShieldCheck className="w-8 h-8" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Mandatory Security Check · One-Time Only
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                  Activate Cloud Mining Node
                </h3>
                <p className="text-xs text-slate-500 font-medium max-w-xs mt-1 leading-relaxed">
                  To protect the mining pool from automated bot farms, all miners must link a TON wallet and complete a one-time <strong className="text-slate-900 font-black">0.05 TON</strong> verification.
                </p>
              </div>

              {/* 2-Step Verification Checklist */}
              <div className="space-y-3 mb-5">
                {/* Step 1: Connect TON Wallet */}
                <div className={cn(
                  "p-3.5 rounded-2xl border transition-colors flex flex-col gap-2.5",
                  currentTonAddress
                    ? "bg-emerald-50/50 border-emerald-200"
                    : "bg-slate-50 border-slate-200/80"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                        currentTonAddress
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-900 text-white"
                      )}>
                        {currentTonAddress ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">Connect TON Wallet</h4>
                        <p className="text-[10px] font-medium text-slate-500">
                          {currentTonAddress
                            ? `Connected: ${currentTonAddress.slice(0, 6)}...${currentTonAddress.slice(-6)}`
                            : 'Link Tonkeeper, Telegram Wallet, or MyTonWallet'}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-extrabold",
                      currentTonAddress ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {currentTonAddress ? 'Connected' : 'Required'}
                    </span>
                  </div>

                  <div className="flex justify-center pt-1">
                    <div className="scale-95 origin-center">
                      <TonConnectButton />
                    </div>
                  </div>
                </div>

                {/* Step 2: One-Time 0.05 TON Verification */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">One-Time On-Chain Verification</h4>
                      <p className="text-[10px] font-medium text-slate-500">
                        Unlocks daily USDT cloud mining permanently
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-900 font-mono tabular-nums block">
                      0.05 TON
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 block">
                      One-Time
                    </span>
                  </div>
                </div>
              </div>

              {/* Action CTA */}
              <div className="space-y-2.5">
                {!currentTonAddress ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => tonConnectUI.openModal()}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl shadow-[0_8px_20px_rgba(15,23,42,0.16)] transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Connect TON Wallet to Continue</span>
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    disabled={isVerifyingTon}
                    onClick={handleVerifyMiningWithTon}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.28)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isVerifyingTon ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Confirming 0.05 TON in Wallet...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify with 0.05 TON & Start Mining</span>
                      </>
                    )}
                  </motion.button>
                )}

                <p className="text-[10px] text-center text-slate-400 font-medium">
                  Verified once per account for both new and existing miners.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

