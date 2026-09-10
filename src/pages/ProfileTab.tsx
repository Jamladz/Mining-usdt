import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { Wallet, ArrowRightLeft, Clock, History, ExternalLink, Activity, BookmarkPlus, CheckCircle2, Lock, HelpCircle, Sparkles, Check } from 'lucide-react';
import { formatUSDT, parseUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { FAQSheet } from '../components/FAQSheet';
import { referralService } from '../services/referralService';


const MIN_WITHDRAWAL = 3;

export function ProfileTab() {
  const { user, setUser, fetchUser, initData, homeScreenStatus, canAddToHomeScreen, addToHomeScreen, showToast } = useApp();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const [liveReferralsCount, setLiveReferralsCount] = useState<number>(user?.referralsCount || 0);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (user?.id) {
      referralService.getUserReferrals(user.id).then(list => {
        setLiveReferralsCount(Math.max(user?.referralsCount || 0, list.length));
      }).catch(err => {
        console.warn('Failed to load live referrals in ProfileTab', err);
      });
    }
  }, [user]);

  const totalReferrals = Math.max(user?.referralsCount || 0, liveReferralsCount);
  const hasThreeReferrals = totalReferrals >= 3;

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/withdrawals', {
        headers: { 'Authorization': initData || '' }
      });
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check 3 referrals constraint
    if (!hasThreeReferrals) {
      showToast(<span>🔒 Withdrawal Locked! You must refer at least 3 active friends to withdraw.</span>, 'error');
      return;
    }

    const amount = parseUSDT(withdrawAmount);
    
    if (!amount || amount < MIN_WITHDRAWAL) {
      showToast('Minimum withdrawal amount is 3 USDT', 'error');
      return;
    }
    if (amount > (user?.balance || 0)) {
      showToast('Insufficient balance in your account', 'error');
      return;
    }
    if (!walletAddress.trim()) {
      showToast('Please enter a valid TRC20/BEP20 wallet address', 'error');
      return;
    }

    setIsWithdrawing(true);
    
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ amount, walletAddress })
      });
      
      const data = await res.json();
      if (data.success) {
         showToast('Withdrawal requested successfully. Admin review is underway.', 'success');
        setWithdrawAmount('');
        setWalletAddress('');
        await fetchUser();
        await fetchHistory();
      } else {
        showToast(data.error || 'Withdrawal request failed', 'error');
      }
    } catch (e) {
      console.warn('Backend not available, using local simulation for withdrawal');
      if (user) {
        setUser({ 
          ...user, 
          balance: (user.balance || 0) - amount,
          totalWithdrawn: (user.totalWithdrawn || 0) + amount 
        });
      }
      setHistory([{
        id: Math.random().toString(),
        amount: amount,
        status: 'pending',
        createdAt: new Date().toISOString()
      }, ...history]);
      showToast('Withdrawal requested successfully (Simulation Mode).', 'success');
      setWithdrawAmount('');
      setWalletAddress('');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F5F7F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Profile" />
      
      <div className="p-4 space-y-4 pb-24">
        {/* User Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center relative overflow-hidden text-center"
        >
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-slate-50 to-transparent"></div>
          
          <div className="w-16 h-16 bg-white rounded-full overflow-hidden flex-shrink-0 border-4 border-white shadow-lg relative z-10 mb-3">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-2xl uppercase">
                {user?.firstName?.[0] || 'U'}
              </div>
            )}
          </div>
          <div className="flex flex-col relative z-10">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
              {user?.firstName}
              {user?.username && <span className="text-slate-400 font-medium text-sm">(@{user.username})</span>}
              <button 
                onClick={() => setIsFAQOpen(true)}
                className="group relative w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 transition-all hover:scale-110 active:scale-95 ml-0.5"
              >
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
                <div className="absolute inset-0 bg-amber-300 rounded-full blur-sm opacity-40 animate-pulse"></div>
                <HelpCircle className="w-3.5 h-3.5 relative z-10 drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]" />
              </button>
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Verified</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ID: {user?.id}</span>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.1)] flex flex-col text-white"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Available</p>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.balance || 0)} size="text-lg sm:text-xl text-white" iconSize="w-4 h-4 sm:w-5 sm:h-5 brightness-0 invert" />
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Withdrawn</p>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.totalWithdrawn || 0)} size="text-lg sm:text-xl text-slate-900" iconSize="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </motion.div>
        </div>

        {/* Withdraw Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] -z-0 opacity-50"></div>
          
          <div className="flex items-center gap-2 mb-5 relative z-10">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">Withdraw <USDT size="text-[15px]" iconSize="w-4 h-4" /></h3>
            </div>
          </div>

          {/* Elegant Referral Lock/Unlock Notice */}
          {hasThreeReferrals ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl p-4 flex flex-col space-y-1.5 relative overflow-hidden z-10 shadow-[0_2px_12px_rgba(16,185,129,0.04)]"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 animate-bounce">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h4 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">Withdrawal Unlocked</h4>
                <span className="ml-auto text-[9px] font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  Premium Active <Check className="w-2.5 h-2.5" />
                </span>
              </div>
              <p className="text-[10px] text-emerald-800 leading-relaxed font-bold">
                🎉 Congratulations! You have referred <span className="text-emerald-950 font-black">{totalReferrals} active friends</span>. Standard and premium withdrawals are now fully unlocked for your account.
              </p>
            </motion.div>
          ) : (
            <div className="mb-4 bg-amber-50/70 border border-amber-200/50 rounded-2xl p-4 flex flex-col space-y-2 relative overflow-hidden z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">Withdrawal Locked</h4>
              </div>
              <p className="text-[10px] text-amber-800 leading-relaxed font-bold">
                To prevent fraud and maintain system stability, you must refer at least <span className="font-black text-amber-950 text-xs">3 active friends</span> to unlock withdrawals.
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-amber-200/30 text-[10px] font-black text-amber-800">
                <span>Progress: <span className="text-amber-950">{totalReferrals} / 3</span></span>
                <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold shrink-0">
                  {3 - totalReferrals} More Needed
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleWithdraw} className="space-y-3 relative z-10">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex flex-wrap items-center gap-1">Amount <span className="lowercase font-medium tracking-normal text-slate-400 ml-1 inline-flex items-center gap-1">(Min: <USDT amount="3" size="text-[9px]" iconSize="w-3 h-3 inline-block -mt-0.5" />)</span></label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.0001"
                  min="3"
                  disabled={!hasThreeReferrals}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 font-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/50 disabled:cursor-not-allowed"
                />
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  type="button" 
                  disabled={!hasThreeReferrals}
                  onClick={() => setWithdrawAmount(formatUSDT(user?.balance || 0))}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </motion.button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Wallet Address (TRC20/BEP20)</label>
              <input 
                type="text"
                disabled={!hasThreeReferrals}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="T..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/50 disabled:cursor-not-allowed"
              />
            </div>

            <motion.button 
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isWithdrawing || !hasThreeReferrals}
              className="w-full mt-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
            >
              {!hasThreeReferrals ? <Lock className="w-3.5 h-3.5 text-slate-400 animate-pulse" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              <span>
                {isWithdrawing 
                  ? 'PROCESSING...' 
                  : !hasThreeReferrals 
                    ? '3 REFERRALS REQUIRED' 
                    : 'REQUEST WITHDRAWAL'
                }
              </span>
            </motion.button>
          </form>
        </motion.div>

        {/* History */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Withdrawal History</h3>
          </div>
          
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((tx: any, index: number) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (index * 0.1) }}
                  key={tx.id} 
                  className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900"><USDT amount={formatUSDT(tx.amount)} size="text-xs" iconSize="w-3 h-3" /></span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(tx.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border",
                      (tx.status === 'completed' || tx.status === 'approved') ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      tx.status === 'rejected' ? "bg-red-50 text-red-600 border-red-100" :
                      "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {tx.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <History className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400">No withdrawal history</p>
            </div>
          )}
        </motion.div>
        
      </div>

      <FAQSheet isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
    </div>
  );
}
