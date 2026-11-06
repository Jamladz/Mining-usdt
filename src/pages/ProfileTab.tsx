import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { Wallet, ArrowRightLeft, Clock, History, ExternalLink, Activity, BookmarkPlus, CheckCircle2, Lock, HelpCircle, Sparkles, Check, X, Zap, Loader2, AlertTriangle, Globe, ShieldAlert, Users, UserPlus, Copy, ShieldCheck, TrendingUp, ChevronRight, Award } from 'lucide-react';
import { formatUSDT, parseUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { FAQSheet } from '../components/FAQSheet';
import { AdminPanelModal } from '../components/AdminPanelModal';
import { referralService } from '../services/referralService';
import { syncHistoryToFirebase, getUserFromFirebase } from "../lib/firebase";
import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

const MIN_WITHDRAWAL = 6;

export function ProfileTab() {
  const { user, setUser, fetchUser, initData, homeScreenStatus, canAddToHomeScreen, addToHomeScreen, showToast } = useApp();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const [liveReferralsCount, setLiveReferralsCount] = useState<number>(user?.referralsCount || 0);
  const [showCongestionModal, setShowCongestionModal] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<'EN' | 'AR' | 'RU' | 'FA'>('EN');
  const [copiedUserId, setCopiedUserId] = useState(false);

  // Admin Panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const handleOpenAdminPanel = () => {
    setShowAdminPanel(true);
  };

  const handleCopyUserId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id.toString());
    setCopiedUserId(true);
    showToast('Account ID copied to clipboard', 'info');
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const [tonConnectUI] = useTonConnectUI();
  const currentTonAddress = useTonAddress();
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [nftStats, setNftStats] = useState<{ lvl1: { sold: number, total: number }, lvl2: { sold: number, total: number } }>({
    lvl1: { sold: 36000, total: 100000 },
    lvl2: { sold: 8300, total: 10000 }
  });

  useEffect(() => {
    fetchHistory();
    fetchNftStats();
  }, []);

  const fetchNftStats = async () => {
    try {
      const res = await fetch('/api/nft-stats');
      const data = await res.json();
      setNftStats(data);
    } catch (e) {
      console.error('Failed to fetch NFT stats', e);
    }
  };

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

  const getInitials = () => {
    if (!user) return 'US';
    
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    if (first && last) {
      return (first[0] + last[0]).toUpperCase();
    }

    const name = first || user.username || 'User';
    const cleanName = name.replace(/[^a-zA-Z0-9\s_.]/g, '').trim();
    if (!cleanName) {
      const rawName = name.trim();
      return rawName.length >= 2 ? rawName.slice(0, 2).toUpperCase() : 'US';
    }

    const parts = cleanName.split(/[\s_.]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    return cleanName.slice(0, 2).toUpperCase();
  };

  const getTelegramGradient = (name: string) => {
    const gradients = [
      'bg-gradient-to-tr from-blue-500 to-sky-600 text-white',      // Telegram Blue
      'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white',  // Violet
      'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white',    // Teal
      'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',    // Orange
      'bg-gradient-to-tr from-rose-500 to-pink-600 text-white',       // Rose
      'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white'         // Cyan
    ];
    let hash = 0;
    const key = name || 'User';
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const nameForGradient = user?.firstName || user?.username || 'User';

  const handlePurchase = async (nft: any) => {
    if (!currentTonAddress) {
      showToast('Please connect your TON wallet first using the Connect button above!', 'error');
      return;
    }
    
    setIsPaying(true);
    try {
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        messages: [
          {
            address: 'UQCTZAMbXoN5T43K9gJXH8GYWBmIstXrUrdoV9kv3btN1Ad3', // receiver address
            amount: (nft.price * 1000000000).toString() // price in nanotons
          }
        ]
      };
      
      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('Transaction sent successfully:', result);
      
      const res = await fetch('/api/purchase-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ nftId: nft.id, price: nft.price })
      });
      
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setSelectedNft(null);
        showToast(
          <div className="flex flex-col gap-0.5 text-left" dir="ltr">
            <span className="text-[13px] font-black text-amber-200">🎉 NFT Purchased!</span>
            <span className="text-[11px] font-bold text-white opacity-90">
              You unlocked Level {nft.level} NFT. Mining rate boosted and withdrawals are now UNLOCKED!
            </span>
          </div>,
          'success'
        );
      } else {
        showToast(data.error || 'Payment recorded but failed to update status', 'error');
      }
    } catch (err: any) {
      console.error('TON transaction failed:', err);
      showToast(err.message || 'Transaction rejected or failed. Please try again.', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/withdrawals', {
        headers: { 'Authorization': initData || '' }
      });
      const data = await res.json();
      
      if (data.history && data.history.length > 0) {
        setHistory(data.history);
        if (user?.id) {
          syncHistoryToFirebase(user.id, 'withdrawalsHistory', data.history);
        }
      } else {
        // SQLite history is empty. Let's check if there is a backup in Firestore!
        if (user?.id) {
          const firestoreUser = await getUserFromFirebase(user.id);
          if (firestoreUser && firestoreUser.withdrawalsHistory) {
            try {
              const parsed = JSON.parse(firestoreUser.withdrawalsHistory);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log('[SYNC] Restoring withdrawals history from Firestore to SQLite');
                setHistory(parsed);
                
                // Synchronize with the SQLite database so it has it too
                const syncRes = await fetch('/api/withdrawals/sync', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': initData || ''
                  },
                  body: JSON.stringify({ history: parsed })
                });
                const syncData = await syncRes.json();
                if (syncData.history) {
                  setHistory(syncData.history);
                }
              } else {
                setHistory([]);
              }
            } catch (e) {
              console.warn('Failed to parse withdrawalsHistory from Firestore', e);
              setHistory([]);
            }
          } else {
            setHistory([]);
          }
        } else {
          setHistory(data.history || []);
        }
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. First Gate: Must have at least 3 referrals
    const hasThreeReferrals = totalReferrals >= 3;
    if (!hasThreeReferrals) {
      showToast(<span>🔒 Withdrawal Locked! You must refer at least 3 active friends to unlock withdrawals.</span>, 'error');
      return;
    }

    // 2. Second Gate: If they have 3 referrals but NO NFT, force them to buy NFT
    const hasNftOwned = (user?.hasNft || 0) >= 1;
    if (!hasNftOwned) {
      showToast(<span>⚠️ Almost there! You must purchase a Mining NFT to verify your account and enable instant withdrawals.</span>, 'info');
      const nftSection = document.getElementById('nft-marketplace');
      if (nftSection) {
        nftSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // 3. Log withdrawal request for Admin Panel visibility & show Congestion Modal
    const parsedReqAmount = parseUSDT(withdrawAmount) || (user?.balance || MIN_WITHDRAWAL * 10000);
    if (walletAddress.trim()) {
      fetch('/api/withdraw/log-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({
          amount: parsedReqAmount,
          walletAddress: walletAddress.trim()
        })
      }).then(res => res.json()).then(data => {
        if (data?.history && user?.id) {
          setHistory(data.history);
          syncHistoryToFirebase(user.id, 'withdrawalsHistory', data.history);
        }
      }).catch(() => {});
    }

    setShowCongestionModal(true);
    return;

    // 4. Validation (Reached only if we wanted to allow real withdrawal)
    const amount = parseUSDT(withdrawAmount);
    
    if (!amount || amount < MIN_WITHDRAWAL * 10000) {
      showToast('Minimum withdrawal amount is 6 USDT', 'error');
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

    // 4. Actual Withdrawal Call
    try {
      setIsWithdrawing(true);
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({
          amount: amount,
          walletAddress: walletAddress.trim()
        })
      });

      const data = await res.json();
      
      if (data.success) {
        showToast('🎉 Withdrawal request submitted! Funds will be processed within 24 hours.', 'success');
        setWithdrawAmount('');
        setWalletAddress('');
        fetchUser(); // Refresh balance
        fetchHistory(); // Refresh history
      } else {
        if (data.error?.toLowerCase().includes('nft')) {
           const nftSection = document.getElementById('nft-marketplace');
           if (nftSection) nftSection.scrollIntoView({ behavior: 'smooth' });
        }
        showToast(data.error || 'Withdrawal failed. Please try again.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error. Please try again later.', 'error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F4F6F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Profile" />
      
      <div className="p-4 space-y-4 pb-28 max-w-md mx-auto">
        {/* Executive Identity & Portfolio Hero Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_10px_35px_rgba(15,23,42,0.04)] overflow-hidden"
        >
          {/* Top Atmospheric Banner */}
          <div className="h-20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden px-4 pt-3 flex items-start justify-between">
            <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-8 w-40 h-40 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center gap-1.5 text-[10px] font-bold text-slate-300 tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Account</span>
              {(user?.hasNft || 0) >= 1 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-300 font-extrabold">VIP Lvl {user?.hasNft}</span>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsFAQOpen(true)}
              aria-label="Open Help & FAQ"
              className="relative z-10 h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-1.5 text-amber-300 text-[10px] font-black transition-all active:scale-95"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQ</span>
            </button>
          </div>

          {/* Profile Avatar & Identity Info */}
          <div className="px-5 pb-5 -mt-10 relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-2.5">
              <div className="w-20 h-20 bg-white rounded-full overflow-hidden border-4 border-white shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center font-black text-2xl uppercase tracking-wide",
                    getTelegramGradient(nameForGradient)
                  )}>
                    {getInitials()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-sm">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
              {user?.firstName || 'Miner'}
            </h2>

            <div className="flex items-center justify-center gap-2 mt-1 text-xs font-semibold text-slate-500">
              {user?.username && (
                <>
                  <span className="text-slate-500" dir="ltr">@{user.username}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                </>
              )}
              <button
                type="button"
                onClick={handleCopyUserId}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors font-mono text-[11px]"
              >
                <span>ID: {user?.id}</span>
                {copiedUserId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>

            {/* Secondary Account Telemetry Bar */}
            <div className="w-full mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-slate-400">Daily Rate</span>
                <span className="text-xs font-black text-slate-900 font-mono tabular-nums mt-0.5 flex items-center justify-center">
                  <USDT amount={'+' + formatUSDT(user?.miningRate || 100)} size="text-xs text-slate-900" iconSize="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex flex-col items-center border-x border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400">Active Friends</span>
                <span className="text-xs font-black text-slate-900 font-mono tabular-nums mt-0.5">
                  {totalReferrals} Referrals
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-slate-400">NFT Tier</span>
                <span className="text-xs font-black text-indigo-600 mt-0.5">
                  {(user?.hasNft || 0) >= 1 ? `Level ${user?.hasNft}` : 'Standard'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Admin Panel Entry - EXCLUSIVELY FOR sekanedr_is */}
        {user?.username?.toLowerCase() === 'sekanedr_is' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-[22px] p-4 text-white border border-amber-500/30 shadow-[0_10px_25px_rgba(15,23,42,0.16)] flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
            onClick={handleOpenAdminPanel}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-slate-950 shrink-0 shadow-md shadow-amber-500/20">
                <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-black tracking-wide text-white">Executive Admin Panel</h4>
                <p className="text-[10px] text-slate-300 font-semibold mt-0.5">Live 24h active users, total users & withdrawals</p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl tracking-wider shadow-sm whitespace-nowrap shrink-0">
              OPEN
            </span>
          </motion.div>
        )}

        {/* Financial Balance & Withdrawn Cards */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-slate-900 rounded-[24px] p-4 shadow-[0_10px_25px_rgba(15,23,42,0.12)] flex flex-col justify-between text-white relative overflow-hidden"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-400">Available Balance</span>
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-1 min-w-0 w-full font-mono tabular-nums">
              <USDT amount={formatUSDT(user?.balance || 0)} size="text-lg sm:text-xl text-white" iconSize="w-5 h-5" />
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[24px] p-4 shadow-[0_8px_25px_rgba(15,23,42,0.03)] border border-slate-200/70 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-400">Total Withdrawn</span>
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-1 min-w-0 w-full font-mono tabular-nums">
              <USDT amount={formatUSDT(user?.totalWithdrawn || 0)} size="text-lg sm:text-xl text-slate-900" iconSize="w-5 h-5" />
            </div>
          </motion.div>
        </div>

        {/* My NFT Collection - ONLY IF OWNED */}
        {user?.hasNft && user.hasNft >= 1 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[26px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] border border-slate-200/70 flex flex-col relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">My Active NFT</h3>
                  <p className="text-[10px] font-semibold text-slate-400">Staked & boosting mining power</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700">
                Active
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 flex items-center gap-3.5 relative z-10">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                <img 
                  src={user.hasNft === 1 
                    ? 'https://i.ibb.co/dJtkVSVV/file-0000000047a48211926b535652563852.png' 
                    : 'https://i.ibb.co/Xx5L13HJ/file-00000000b9f481f491fc3471e26e01db.png'} 
                  alt="My NFT" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <span className={cn(user.hasNft === 1 ? "text-amber-700" : "text-indigo-700")}>
                    Level {user.hasNft}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">#NFT-{user.id.slice(-4).toUpperCase()}</span>
                </div>
                <h4 className="text-sm font-black text-slate-900 mt-0.5 truncate">
                  {user.hasNft === 1 ? 'Bronze NFT (Lvl 1)' : 'Silver NFT (Lvl 2)'}
                </h4>
                <span className="text-[11px] font-extrabold text-emerald-600 mt-0.5 flex items-center gap-1">
                  <USDT amount={user.hasNft === 1 ? '+1.00' : '+3.50'} size="text-[11px] text-emerald-600" iconSize="w-3.5 h-3.5" />
                  <span>/ Day Boost</span>
                </span>
              </div>
              <div className="w-9 h-9 bg-white rounded-full border border-slate-200/80 flex items-center justify-center shadow-xs shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </motion.div>
        )}

        {/* NFT Marketplace Section */}
        <motion.div 
          id="nft-marketplace"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[28px] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Mining NFT Passes</h3>
                <p className="text-[11px] text-slate-500 font-medium">Unlocks instant withdrawals & daily boost</p>
              </div>
            </div>
            {(user?.hasNft || 0) >= 1 && (
              <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 shrink-0">
                <Check className="w-3 h-3" /> Verified
              </span>
            )}
          </div>

          {/* TON Wallet Connection Dock */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-200/60">
            <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-slate-600 text-center">
              {currentTonAddress ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-mono text-slate-800">
                    {currentTonAddress.slice(0, 6)}...{currentTonAddress.slice(-6)}
                  </span>
                </>
              ) : (
                <span>Connect your TON wallet for instant on-chain NFT minting</span>
              )}
            </div>
            <div className="scale-95 origin-center">
              <TonConnectButton />
            </div>
          </div>

          {/* NFT Grid - Two NFTs per row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'lvl1',
                level: 1,
                name: 'Bronze NFT (Lvl 1)',
                price: 1, // 1 TON
                image: 'https://i.ibb.co/dJtkVSVV/file-0000000047a48211926b535652563852.png',
                boost: '+1.00 USDT/24h Rate',
                description: 'Must purchase at least Level 1 NFT to enable withdrawals and increase mining speed.'
              },
              {
                id: 'lvl2',
                level: 2,
                name: 'Silver NFT (Lvl 2)',
                price: 3, // 3 TON
                image: 'https://i.ibb.co/Xx5L13HJ/file-00000000b9f481f491fc3471e26e01db.png',
                boost: '+3.50 USDT/24h Rate',
                description: 'Boosts your mining rate by +3.50 USDT per day and guarantees VIP withdrawal speeds.'
              }
            ].map((nft) => {
              const isOwned = user?.hasNft === nft.level;
              const stats = nftStats[nft.id === 'lvl1' ? 'lvl1' : 'lvl2'];
              const soldCount = stats.sold;
              const totalCount = stats.total;
              const progress = (soldCount / totalCount) * 100;

              return (
                <motion.div
                  key={nft.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedNft(nft)}
                  className={cn(
                    "group relative bg-slate-50/80 border rounded-2xl p-3 flex flex-col text-left cursor-pointer transition-all",
                    isOwned
                      ? "border-emerald-400 bg-emerald-50/20"
                      : "border-slate-200/80 hover:border-slate-300 hover:bg-white"
                  )}
                >
                  {isOwned && (
                    <div className="absolute top-2.5 right-2.5 bg-emerald-600 text-white rounded-full p-1 z-10 shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                  
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-200/60 mb-2.5 relative">
                    <img 
                      src={nft.image} 
                      alt={nft.name} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-black text-white font-mono tabular-nums">
                      {nft.price} TON
                    </div>
                  </div>
                  
                  <h4 className="text-xs font-black text-slate-900 line-clamp-1 leading-tight">{nft.name}</h4>
                  <div className="text-[10px] font-extrabold text-indigo-600 mt-0.5 flex items-center gap-1">
                    <USDT amount={nft.level === 1 ? '+1.00' : '+3.50'} size="text-[10px] text-indigo-600" iconSize="w-3.5 h-3.5" />
                    <span>/ 24h Rate</span>
                  </div>

                  {/* NFT Supply Progress Bar */}
                  <div className="w-full mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 font-mono tabular-nums">
                      <span>Minted</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${progress}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          nft.level === 1 ? "bg-amber-500" : "bg-indigo-600"
                        )}
                      />
                    </div>
                    <p className="text-[9px] font-semibold text-slate-400 font-mono tabular-nums text-right">
                      {soldCount.toLocaleString()} / {totalCount.toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Withdraw Form Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[28px] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Withdraw</span>
                  <USDT size="text-[15px]" iconSize="w-4 h-4" />
                </h3>
                <p className="text-[11px] font-medium text-slate-500">Fast payout to TRC20 or BEP20 wallet</p>
              </div>
            </div>
          </div>

          {/* Referral & NFT Lock/Unlock Notice (Preserving exact hidden & visible elements) */}
          {(() => {
            const hasReferrals = totalReferrals >= 3;
            const hasNft = (user?.hasNft || 0) >= 1;
            const isWithdrawalUnlocked = hasReferrals && hasNft;

            if (isWithdrawalUnlocked) {
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 bg-emerald-50/80 border border-emerald-200/70 rounded-2xl p-4 flex flex-col space-y-1.5 relative z-10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h4 className="text-xs font-black text-emerald-950">Verification Complete</h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700">
                      Unlocked
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                    Your account is verified. Withdrawals are now enabled.
                  </p>
                </motion.div>
              );
            }

            const referralProgressPct = Math.min(100, Math.round((totalReferrals / 3) * 100));

            return (
              <div className="mb-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col space-y-2 relative z-10">
                <div className="flex items-center gap-2 hidden">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">Verification Steps</h4>
                </div>
                <p className="text-[10px] text-amber-800 leading-relaxed font-bold hidden">
                  Complete these steps to unlock your first withdrawal:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      {hasReferrals ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>Refer 3 active friends</span>
                    </span>
                    <span className={cn(
                      "font-mono tabular-nums text-xs font-black",
                      hasReferrals ? "text-emerald-600" : "text-amber-700"
                    )}>
                      {totalReferrals} / 3
                    </span>
                  </div>
                  {/* Subtle visual progress bar for the 3 referrals requirement */}
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${referralProgressPct}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        hasReferrals ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                  </div>
                  <div className={cn(
                    "flex items-center justify-between text-[10px] font-extrabold px-2.5 py-1 rounded-xl hidden",
                    hasNft ? "bg-emerald-100/40 text-emerald-900" : "bg-amber-100/40 text-amber-900"
                  )}>
                    <span className="flex items-center gap-1.5">
                      {hasNft ? <Check className="w-3 h-3" /> : "2."} Purchase Mining NFT
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[8px]", hasNft ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                      {hasNft ? "Purchased" : "Required"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleWithdraw} className="space-y-3.5 relative z-10">
            {(() => {
              const isWithdrawalUnlocked = totalReferrals >= 3;
              return (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <span>Withdrawal Amount</span>
                        <button
                          type="button"
                          onClick={() => showToast('The minimum withdrawal threshold has been increased to 6 USDT due to high withdrawal request volume.', 'info')}
                          className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        >
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </label>
                      <span className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1 font-mono tabular-nums">
                        Min: <USDT amount={MIN_WITHDRAWAL.toString()} size="text-[11px]" iconSize="w-3 h-3 inline-block -mt-0.5" />
                      </span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.0001"
                        min={MIN_WITHDRAWAL}
                        disabled={!isWithdrawalUnlocked}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.0000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-4 pr-16 text-slate-900 font-black text-sm font-mono tabular-nums focus:outline-none focus:bg-white focus:border-slate-900 transition-all placeholder:text-slate-300 placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/60 disabled:cursor-not-allowed"
                      />
                      <motion.button 
                        whileTap={{ scale: 0.96 }}
                        type="button" 
                        disabled={!isWithdrawalUnlocked}
                        onClick={() => setWithdrawAmount(formatUSDT(user?.balance || 0))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        MAX
                      </motion.button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <label className="text-[11px] font-bold text-slate-600">Destination Wallet Address</label>
                      <span className="text-[10px] font-semibold text-slate-400">TRC20 · BEP20</span>
                    </div>
                    <input 
                      type="text"
                      disabled={!isWithdrawalUnlocked}
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="Enter TRC20 or BEP20 address..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-900 font-bold text-xs font-mono focus:outline-none focus:bg-white focus:border-slate-900 transition-all placeholder:text-slate-300 placeholder:font-sans placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isWithdrawing || !isWithdrawalUnlocked}
                    className="w-full h-12 mt-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                  >
                    {!isWithdrawalUnlocked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    <span>
                      {isWithdrawing 
                        ? 'Processing Request...' 
                        : !isWithdrawalUnlocked 
                          ? 'Refer 3 Friends to Unlock' 
                          : 'Request Withdrawal'
                      }
                    </span>
                  </motion.button>
                </>
              );
            })()}
          </form>
        </motion.div>

        {/* Withdrawal History Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-[28px] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] border border-slate-200/70"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Withdrawal History</h3>
                <p className="text-[10px] font-medium text-slate-400">Recent payout transactions</p>
              </div>
            </div>
            {history.length > 0 && (
              <span className="text-[11px] font-bold text-slate-400 font-mono tabular-nums">
                {history.length} {history.length === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
          
          {history.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {history.map((tx: any, index: number) => {
                const status = (tx.status || 'pending').toLowerCase();
                return (
                  <div 
                    key={tx.id || index} 
                    className="py-3 first:pt-0 last:pb-0 flex justify-between items-center gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="text-xs font-black text-slate-900 font-mono tabular-nums">
                        <USDT amount={formatUSDT(tx.amount)} size="text-xs" iconSize="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                        <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                        {tx.walletAddress && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono truncate max-w-[120px]">{tx.walletAddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <span className={cn(
                        "text-[11px] font-bold capitalize",
                        status === 'completed' ? "text-emerald-600" :
                        status === 'rejected' ? "text-red-600" :
                        "text-amber-600"
                      )}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <div className="w-10 h-10 bg-white rounded-full border border-slate-200/80 flex items-center justify-center mb-2 shadow-2xs">
                <History className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-600">No withdrawal history yet</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">Your completed payouts will appear here</p>
            </div>
          )}
        </motion.div>
        
      </div>

      {/* 75% Sliding Bottom Sheet for NFT Purchase Details */}
      <AnimatePresence>
        {selectedNft && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm">
            {/* Click backdrop to close */}
            <div className="absolute inset-0" onClick={() => setSelectedNft(null)}></div>
            
            {/* Bottom Sheet container, covering exactly 75% of height with z-[100] above bottom nav */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-md bg-white rounded-t-[32px] p-6 pb-9 sm:pb-6 shadow-2xl border-t border-slate-100 flex flex-col h-[75vh] relative z-10 overflow-hidden"
            >
              {/* Grab handle/indicator */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedNft(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Scrollable details container */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
                <div className="flex flex-col items-center text-center">
                  <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 shadow-md mb-3 relative">
                    <img 
                      src={selectedNft.image} 
                      alt={selectedNft.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2 right-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-0.5 rounded-lg text-[10px] font-black text-white font-mono tabular-nums">
                      {selectedNft.price} TON
                    </div>
                  </div>
                  
                  <span className="text-[11px] font-bold text-indigo-600 mb-0.5">
                    Level {selectedNft.level} Mining Pass
                  </span>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{selectedNft.name}</h3>
                  <div className="text-xs font-extrabold text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
                    <USDT amount={selectedNft.level === 1 ? '+1.00' : '+3.50'} size="text-xs text-emerald-600" iconSize="w-4 h-4" />
                    <span>/ 24h Rate Boost</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-3.5">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Mining Rate Boost</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Purchasing this NFT permanently adds <span className="font-extrabold text-indigo-600">{selectedNft.boost}</span> to your mining engine, allowing you to earn USDT significantly faster.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-slate-200/60">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">Unlocks Instant Withdrawals</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        {selectedNft.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center px-4">
                  <p className="text-[10px] text-slate-400 font-medium leading-normal">
                    Verified on-chain payment via TON Connect. Canceling in your wallet will safely abort the transaction.
                  </p>
                </div>
              </div>

              {/* Action Payment Section */}
              <div className="pt-4 border-t border-slate-100 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Total Mint Price</span>
                  <p className="text-lg font-black text-slate-900 font-mono tabular-nums">{selectedNft.price} TON</p>
                </div>

                {user?.hasNft === selectedNft.level ? (
                  <button
                    disabled
                    className="w-full h-12 bg-slate-100 text-slate-400 text-xs font-black rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span>Already Owned</span>
                  </button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={isPaying}
                    onClick={() => handlePurchase(selectedNft)}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Confirming TON Transaction...</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        <span>Pay {selectedNft.price} TON & Claim NFT</span>
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multilingual Withdrawal Congestion Notice Modal */}
      <AnimatePresence>
        {showCongestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCongestionModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            ></motion.div>

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative bg-white rounded-[28px] max-w-sm w-full overflow-hidden border border-slate-100 shadow-[0_24px_50px_rgba(0,0,0,0.18)] flex flex-col z-10"
            >
              {/* Header warning gradient */}
              <div className="bg-gradient-to-b from-amber-50 to-transparent p-6 pb-2 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3 relative">
                  <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-15"></div>
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5 justify-center">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Network Status</span>
                </h3>
              </div>

              {/* Multilingual Tabs */}
              <div className="px-5 mb-4">
                <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1 text-[10px] font-black">
                  {[
                    { code: 'EN', label: '🇺🇸 EN' },
                    { code: 'AR', label: '🇸🇦 AR' },
                    { code: 'RU', label: '🇷🇺 RU' },
                    { code: 'FA', label: '🇮🇷 FA' }
                  ].map((tab) => (
                    <button
                      key={tab.code}
                      onClick={() => setActiveLangTab(tab.code as any)}
                      className={cn(
                        "flex-1 py-2 rounded-lg transition-all text-center",
                        activeLangTab === tab.code 
                          ? "bg-slate-900 text-white shadow-sm" 
                          : "text-slate-500 hover:bg-slate-200/50"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Content with automatic RTL support */}
              <div 
                className={cn(
                  "px-6 pb-6 min-h-[160px] flex flex-col justify-center",
                  (activeLangTab === 'AR' || activeLangTab === 'FA') ? "text-right" : "text-left"
                )}
                dir={(activeLangTab === 'AR' || activeLangTab === 'FA') ? 'rtl' : 'ltr'}
              >
                <AnimatePresence mode="wait">
                  {activeLangTab === 'EN' && (
                    <motion.div
                      key="EN"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-2"
                    >
                      <h4 className="text-[14px] font-black text-slate-900">System Congestion Notice</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        Due to an unprecedented volume of concurrent withdrawal requests on the TON blockchain, automatic withdrawals have been temporarily suspended to prevent transaction failures and queue blockages. The gateway is undergoing optimization and will be reopened shortly. Thank you for your patience.
                      </p>
                    </motion.div>
                  )}

                  {activeLangTab === 'AR' && (
                    <motion.div
                      key="AR"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-2"
                    >
                      <h4 className="text-[14px] font-black text-slate-900">تنبيه ازدحام النظام</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        بسبب حجم غير مسبوق من طلبات السحب المتزامنة على شبكة TON، تم تعليق السحوبات التلقائية مؤقتاً لمنع فشل المعاملات وازدحام الدور. تخضع بوابة الدفع حالياً للتحسينات وسيتم إعادة فتحها قريباً جداً. شكراً لتفهمكم وصبركم.
                      </p>
                    </motion.div>
                  )}

                  {activeLangTab === 'RU' && (
                    <motion.div
                      key="RU"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-2"
                    >
                      <h4 className="text-[14px] font-black text-slate-900">Уведомление о перегрузке системы</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        В связи с беспрецедентным объемом одновременных запросов на вывод средств в сети TON, автоматические выплаты временно приостановлены для предотвращения сбоев транзакций и блокировки очереди. Платежный шлюз оптимизируется и будет открыт в ближайшее время. Спасибо за терпение.
                      </p>
                    </motion.div>
                  )}

                  {activeLangTab === 'FA' && (
                    <motion.div
                      key="FA"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-2"
                    >
                      <h4 className="text-[14px] font-black text-slate-900">اطلاعیه شلوغی شبکه</h4>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        به دلیل حجم بی‌سابقه درخواست‌های همزمان برداشت در شبکه TON، برداشت‌های خودکار به طور موقت متوقف شده‌اند تا از تراکنش‌های ناموفق و انسداد صف جلوگیری شود. درگاه پرداخت در حال بهینه‌سازی است و به زودی بازگشایی خواهد شد. از شکیبایی شما سپاسگزاریم.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Button */}
              <div className="px-6 pb-6 pt-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCongestionModal(false)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ACKNOWLEDGE</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AdminPanelModal
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        initData={initData || ''}
        showToast={showToast}
      />

      <FAQSheet isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
    </div>
  );
}
