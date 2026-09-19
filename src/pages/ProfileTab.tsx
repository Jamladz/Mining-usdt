import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { Wallet, ArrowRightLeft, Clock, History, ExternalLink, Activity, BookmarkPlus, CheckCircle2, Lock, HelpCircle, Sparkles, Check, X, Zap, Loader2, AlertTriangle, Globe, ShieldAlert, Users } from 'lucide-react';
import { formatUSDT, parseUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { FAQSheet } from '../components/FAQSheet';
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

  // Admin Panel states & fetch
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminStats, setAdminStats] = useState<{ totalUsers: number, activeUsers24h: number } | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const fetchAdminStats = async () => {
    setIsAdminLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': initData || '' }
      });
      if (!res.ok) throw new Error('Unauthorized or failed to load stats');
      const data = await res.json();
      setAdminStats(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load actual admin statistics.', 'error');
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleOpenAdminPanel = () => {
    setShowAdminPanel(true);
    fetchAdminStats();
  };

  const [tonConnectUI] = useTonConnectUI();
  const currentTonAddress = useTonAddress();
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [isPaying, setIsPaying] = useState(false);

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
    
    // Check withdrawal criteria (3 referrals OR Level 1 NFT owned)
    const hasNftOwned = user?.hasNft === 1;
    const hasThreeReferrals = totalReferrals >= 3;
    const isWithdrawalUnlocked = hasThreeReferrals || hasNftOwned;

    if (!isWithdrawalUnlocked) {
      showToast(<span>🔒 Withdrawal Locked! You must refer at least 3 active friends OR purchase at least the Level 1 NFT to withdraw.</span>, 'error');
      return;
    }

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

    // Trigger the multi-lingual congestion notice modal!
    setShowCongestionModal(true);
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
              <div className={cn(
                "w-full h-full flex items-center justify-center font-black text-xl uppercase tracking-wide",
                getTelegramGradient(nameForGradient)
              )}>
                {getInitials()}
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

        {/* Admin Panel Entry - STRICTLY ONLY FOR sekanedr_is */}
        {(user?.id?.toString() === '1368899842' || user?.username?.toLowerCase() === 'sekanedr_is') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-[20px] p-4 text-white shadow-[0_8px_25px_rgba(245,158,11,0.25)] flex items-center justify-between cursor-pointer my-1.5"
            onClick={handleOpenAdminPanel}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-black uppercase tracking-wider">Admin Panel</h4>
                <p className="text-[10px] text-amber-100 font-bold">Real-time platform metrics & stats</p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-white text-orange-600 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              ENTER
            </span>
          </motion.div>
        )}

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

        {/* NFT Divider */}
        <div className="border-t border-slate-200/80 my-2"></div>

        {/* NFT Marketplace Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Premium NFT Access</h3>
              <p className="text-[10px] text-slate-400 font-bold">Unlocks withdrawals & boosts mining speed</p>
            </div>
            {user?.hasNft === 1 && (
              <span className="ml-auto text-[9px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1 shrink-0">
                Active Member <Check className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          {/* TON Wallet Connection Button */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50/70 border border-slate-100 rounded-2xl mb-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            <p className="text-[10px] text-slate-500 font-bold mb-2.5 text-center leading-relaxed">
              {currentTonAddress 
                ? `Connected Wallet: ${currentTonAddress.slice(0, 6)}...${currentTonAddress.slice(-6)}` 
                : 'Connect your TON wallet to buy NFTs using secure decentralized payments.'}
            </p>
            <div className="scale-95 origin-center">
              <TonConnectButton />
            </div>
          </div>

          {/* NFT Grid - Two NFTs per row */}
          <div className="grid grid-cols-2 gap-3.5">
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
              const isOwned = user?.hasNft === 1 && nft.level === 1;
              return (
                <motion.div
                  key={nft.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedNft(nft)}
                  className={cn(
                    "relative bg-slate-50 border rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer transition-all",
                    isOwned ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200/80 hover:border-indigo-200"
                  )}
                >
                  {isOwned && (
                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white rounded-full p-0.5 z-10 shadow-sm">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50 mb-2 relative">
                    <img 
                      src={nft.image} 
                      alt={nft.name} 
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wider">
                      {nft.price} TON
                    </div>
                  </div>
                  
                  <h4 className="text-[11px] font-black text-slate-800 line-clamp-1 leading-tight">{nft.name}</h4>
                  <p className="text-[9px] font-black text-indigo-600 mt-1">{nft.boost}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* NFT Divider */}
        <div className="border-t border-slate-200/80 my-2"></div>

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

          {/* Elegant Referral or NFT Lock/Unlock Notice */}
          {(() => {
            const isWithdrawalUnlocked = totalReferrals >= 3 || user?.hasNft === 1;
            return isWithdrawalUnlocked ? (
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
                    Active Status <Check className="w-2.5 h-2.5" />
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed font-bold">
                  🎉 Congratulations! You have unlocked withdrawals by satisfying the required criteria ({user?.hasNft === 1 ? 'Level 1 NFT Owned' : `3 Active Referrals achieved`}).
                </p>
              </motion.div>
            ) : (
              <div className="mb-4 bg-amber-50/70 border border-amber-200/50 rounded-2xl p-4 flex flex-col space-y-2.5 relative overflow-hidden z-10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-[11px] font-black text-amber-950 uppercase tracking-wider">Withdrawal Locked</h4>
                </div>
                <p className="text-[10px] text-amber-800 leading-relaxed font-bold">
                  To unlock withdrawals, you must satisfy **at least ONE** of the following requirements:
                </p>
                <div className="space-y-1.5 pl-1">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-900 bg-amber-100/40 px-2.5 py-1 rounded-xl">
                    <span>1. Refer 3 active friends</span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[8px]">
                      Progress: {totalReferrals} / 3
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-900 bg-amber-100/40 px-2.5 py-1 rounded-xl">
                    <span>2. Purchase Level 1 NFT</span>
                    <span className="text-amber-700 text-[8px] uppercase tracking-wider">Price: 1 TON</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <form onSubmit={handleWithdraw} className="space-y-3 relative z-10">
            {(() => {
              const isWithdrawalUnlocked = totalReferrals >= 3 || user?.hasNft === 1;
              return (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex flex-wrap items-center gap-1">
                      Amount 
                      <span className="lowercase font-medium tracking-normal text-slate-400 ml-1 inline-flex items-center gap-1">
                        (Min: <USDT amount={MIN_WITHDRAWAL.toString()} size="text-[9px]" iconSize="w-3 h-3 inline-block -mt-0.5" />)
                      </span>
                      <button
                        type="button"
                        onClick={() => showToast('The minimum withdrawal threshold has been increased to 6 USDT due to high withdrawal request volume.', 'info')}
                        className="ml-1 flex items-center justify-center relative w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                      >
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30"></span>
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.0001"
                        min={MIN_WITHDRAWAL}
                        disabled={!isWithdrawalUnlocked}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.0000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 font-black text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/50 disabled:cursor-not-allowed"
                      />
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        type="button" 
                        disabled={!isWithdrawalUnlocked}
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
                      disabled={!isWithdrawalUnlocked}
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="T..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-medium disabled:opacity-50 disabled:bg-slate-100/50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isWithdrawing || !isWithdrawalUnlocked}
                    className="w-full mt-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
                  >
                    {!isWithdrawalUnlocked ? <Lock className="w-3.5 h-3.5 text-slate-400 animate-pulse" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    <span>
                      {isWithdrawing 
                        ? 'PROCESSING...' 
                        : !isWithdrawalUnlocked 
                          ? 'REQUIREMENTS NOT MET' 
                          : 'REQUEST WITHDRAWAL'
                      }
                    </span>
                  </motion.button>
                </>
              );
            })()}
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
                      tx.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
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
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedNft(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Scrollable details container */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-2">
                <div className="flex flex-col items-center text-center">
                  <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-50 border-2 border-slate-100 shadow-md mb-3 relative">
                    <img 
                      src={selectedNft.image} 
                      alt={selectedNft.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-1.5 right-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-0.5 rounded-md text-[10px] font-black text-white uppercase tracking-wider">
                      {selectedNft.price} TON
                    </div>
                  </div>
                  
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1">
                    Level {selectedNft.level} premium nft
                  </span>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{selectedNft.name}</h3>
                  <p className="text-xs font-black text-indigo-600 mt-1">{selectedNft.boost} Boost</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">Mining Rate Boost</h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Purchasing this NFT permanently adds <span className="font-extrabold text-indigo-600">{selectedNft.boost}</span> to your mining engine, allowing you to earn USDT significantly faster!
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800">Unlocks Instant Withdrawals</h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        {selectedNft.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center px-4">
                  <p className="text-[10px] text-slate-400 font-bold leading-normal">
                    This is a real payment process verified secure on the TON Blockchain. Re-routing or canceling will abort the operation.
                  </p>
                </div>
              </div>

              {/* Action Payment Section */}
              <div className="pt-4 border-t border-slate-100 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Total cost</span>
                    <p className="text-lg font-black text-slate-900">{selectedNft.price} TON</p>
                  </div>
                </div>

                {user?.hasNft === 1 && selectedNft.level === 1 ? (
                  <button
                    disabled
                    className="w-full bg-slate-100 text-slate-400 text-xs font-black py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span>YOU ALREADY OWN THIS NFT</span>
                  </button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={isPaying}
                    onClick={() => handlePurchase(selectedNft)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-3.5 rounded-xl shadow-[0_4px_16px_rgba(79,70,229,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>PROCESSING TON TRANSACTION...</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        <span>PAY {selectedNft.price} TON & CLAIM NFT</span>
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

      {/* Multilingual Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPanel(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            ></motion.div>

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative bg-white rounded-[28px] max-w-sm w-full overflow-hidden border border-slate-100 shadow-[0_24px_50px_rgba(0,0,0,0.18)] flex flex-col z-10 text-slate-900"
            >
              {/* Header warning gradient */}
              <div className="bg-gradient-to-b from-amber-50 to-transparent p-6 pb-2 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3 relative">
                  <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-15"></div>
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5 justify-center">
                  <Globe className="w-3.5 h-3.5" />
                  <span>
                    {activeLangTab === 'EN' && 'Secure Admin Portal'}
                    {activeLangTab === 'AR' && 'بوابة الإدارة الآمنة'}
                    {activeLangTab === 'RU' && 'Безопасный портал'}
                    {activeLangTab === 'FA' && 'پورتال امنیتی مدیریت'}
                  </span>
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
                  "px-6 pb-4 flex flex-col justify-center min-h-[160px]",
                  (activeLangTab === 'AR' || activeLangTab === 'FA') ? "text-right" : "text-left"
                )}
                dir={(activeLangTab === 'AR' || activeLangTab === 'FA') ? 'rtl' : 'ltr'}
              >
                {isAdminLoading ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-500">
                      {activeLangTab === 'EN' && 'Fetching secure database stats...'}
                      {activeLangTab === 'AR' && 'جاري جلب إحصائيات قاعدة البيانات...'}
                      {activeLangTab === 'RU' && 'Получение данных из базы...'}
                      {activeLangTab === 'FA' && 'در حال دریافت اطلاعات امن...'}
                    </p>
                  </div>
                ) : adminStats ? (
                  <div className="space-y-4">
                    {/* Header title */}
                    <div className="space-y-1">
                      <h4 className="text-[14px] font-black text-slate-900">
                        {activeLangTab === 'EN' && 'System Analytics'}
                        {activeLangTab === 'AR' && 'تحليلات النظام'}
                        {activeLangTab === 'RU' && 'Аналитика системы'}
                        {activeLangTab === 'FA' && 'تحلیل سیستم'}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400">
                        {activeLangTab === 'EN' && 'Live operational statistics retrieved from real database.'}
                        {activeLangTab === 'AR' && 'بيانات التشغيل الحية المستردة من قاعدة البيانات الحقيقية.'}
                        {activeLangTab === 'RU' && 'Реальная статистика, полученная из живой базы данных.'}
                        {activeLangTab === 'FA' && 'آمار واقعی دریافت شده از دیتابیس زنده سیستم.'}
                      </p>
                    </div>

                    {/* Stats Layout */}
                    <div className="space-y-2.5">
                      {/* Stat 1: Total Users */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="text-left" dir="ltr">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">
                              {activeLangTab === 'EN' && 'Total Users'}
                              {activeLangTab === 'AR' && 'إجمالي المستخدمين'}
                              {activeLangTab === 'RU' && 'Всего'}
                              {activeLangTab === 'FA' && 'کل کاربران'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">Registered Accounts</span>
                          </div>
                        </div>
                        <span className="text-base font-black text-slate-900 font-mono">
                          {adminStats.totalUsers}
                        </span>
                      </div>

                      {/* Stat 2: Active Users */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 relative">
                            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                            <Activity className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="text-left" dir="ltr">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">
                              {activeLangTab === 'EN' && 'Active (24h)'}
                              {activeLangTab === 'AR' && 'النشطين (24 ساعة)'}
                              {activeLangTab === 'RU' && 'Активные (24ч)'}
                              {activeLangTab === 'FA' && 'فعال (۲۴ ساعت)'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">Real Interaction</span>
                          </div>
                        </div>
                        <span className="text-base font-black text-emerald-600 font-mono">
                          {adminStats.activeUsers24h}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-center font-bold text-red-500">Failed to load statistics.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="px-6 pb-6 pt-2 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={isAdminLoading}
                  onClick={fetchAdminStats}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Activity className={cn("w-4 h-4", isAdminLoading && "animate-spin")} />
                  <span>
                    {activeLangTab === 'EN' && 'REFRESH'}
                    {activeLangTab === 'AR' && 'تحديث'}
                    {activeLangTab === 'RU' && 'ОБНОВИТЬ'}
                    {activeLangTab === 'FA' && 'بروزرسانی'}
                  </span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAdminPanel(false)}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>
                    {activeLangTab === 'EN' && 'CLOSE'}
                    {activeLangTab === 'AR' && 'إغلاق'}
                    {activeLangTab === 'RU' && 'ЗАКРЫТЬ'}
                    {activeLangTab === 'FA' && 'بستن'}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FAQSheet isOpen={isFAQOpen} onClose={() => setIsFAQOpen(false)} />
    </div>
  );
}
