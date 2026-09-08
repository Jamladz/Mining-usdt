import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { 
  Users, 
  Copy, 
  Share2, 
  Pickaxe, 
  CheckCircle2, 
  Gift, 
  Trophy, 
  Medal, 
  Sparkles, 
  Loader2,
  Clock,
  Search,
  Database
} from 'lucide-react';
import { formatUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { lookupUserByTelegramId } from '../lib/firebase';

export function ReferralHub() {
  const { user, setUser, initData, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invite' | 'friends' | 'leaderboard' | 'search'>('invite');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const result = await lookupUserByTelegramId(searchQuery.trim());
      if (result) {
        setSearchResult(result);
        showToast('🔍 User found on Firebase!', 'success');
      } else {
        setSearchError('No miner has been synchronized with this Telegram ID yet.');
        showToast('No user found', 'error');
      }
    } catch (err) {
      setSearchError('Error querying database. Please try again.');
      showToast('Search query failed', 'error');
    } finally {
      setSearching(false);
    }
  };
  
  // Custom prefix 'ref_tg_' as requested
  const referralLink = `https://t.me/Miningusdt2027_bot?startapp=ref_tg_${user?.id || 'demo123'}`;

  const MILESTONES = [
    { id: 'm1', target: 3, rewardUsdt: 0.3, rewardRate: 0.05 },
    { id: 'm2', target: 10, rewardUsdt: 1.0, rewardRate: 0.10 },
    { id: 'm3', target: 25, rewardUsdt: 2.5, rewardRate: 0.20 },
    { id: 'm4', target: 50, rewardUsdt: 5.0, rewardRate: 0.50 },
    { id: 'm5', target: 100, rewardUsdt: 10.0, rewardRate: 1.0 },
  ];

  const fetchReferrals = async () => {
    if (!initData) return;
    try {
      const res = await fetch('/api/referrals', {
        headers: { 'Authorization': initData }
      });
      const data = await res.json();
      if (data.friends) setFriends(data.friends);
    } catch (e) {
      console.warn("Using simulation mode for friends list");
    }
  };

  const fetchLeaderboard = async () => {
    if (!initData) return;
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/referrals/leaderboard', {
        headers: { 'Authorization': initData }
      });
      const data = await res.json();
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, [initData]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab, initData]);

  const claimedMilestones = (() => {
    try {
      return JSON.parse(user?.claimedMilestones || '[]');
    } catch {
      return [];
    }
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showToast('📋 Referral link copied successfully!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = `💰 Start mining USDT for free with instant withdrawals!
🎁 Get a 0.7 USDT instant welcome bonus when you register using my link!
🚀 Click the link and start earning now:`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleClaimMilestone = async (m: any) => {
    if (claimingMilestone || claimedMilestones.includes(m.id)) return;
    
    const currentRefs = user?.referralsCount || 0;
    if (currentRefs < m.target) return;
    
    setClaimingMilestone(m.id);
    
    try {
      const res = await fetch('/api/referrals/milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ milestoneId: m.id })
      });
      
      const data = await res.json();
      if (data.success && data.user) {
        setUser({
          ...data.user,
          referralsCount: currentRefs
        });
        showToast(`🎉 Congratulations! You received +${m.rewardUsdt} USDT and a mining speed boost!`, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.warn('Simulation mode for claiming milestone');
      if (user) {
        const newClaimed = [...claimedMilestones, m.id];
        setUser({
          ...user,
          balance: (user.balance || 0) + (m.rewardUsdt * 10000), 
          miningRate: (user.miningRate || 0) + (m.rewardRate * 10000), 
          claimedMilestones: JSON.stringify(newClaimed)
        });
        showToast(`🎉 Congratulations! You received +${m.rewardUsdt} USDT and a mining speed boost!`, 'success');
      }
    } finally {
      setClaimingMilestone(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F5F7F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Referral Hub" />
      
      <div className="p-4 space-y-4 pb-24">
        
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Invited Friends</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{user?.referralsCount || 0}</p>
            </div>
            <div className="text-[9px] font-bold text-slate-500 mt-2 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded w-fit">
              <Users className="w-3 h-3 text-emerald-500" />
              <span>Active Network</span>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-emerald-50 rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-emerald-100 flex flex-col justify-between"
          >
            <div>
              <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Earned Bonus</p>
              <div className="flex items-center gap-1 min-w-0 w-full">
                <USDT amount={formatUSDT(user?.referralBonusEarned || 0)} size="text-2xl text-emerald-700" iconSize="w-5 h-5" className="truncate font-black" />
              </div>
            </div>
            <div className="text-[9px] font-bold text-emerald-700 mt-2 flex items-center gap-1 bg-emerald-100/50 px-2 py-1 rounded w-fit">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Milestones Earned</span>
            </div>
          </motion.div>
        </div>

        {/* Tab Selector */}
        <div className="bg-slate-200/60 p-1 rounded-2xl flex gap-1 border border-slate-100">
          <button
            onClick={() => setActiveTab('invite')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all font-bold text-[10px]",
              activeTab === 'invite' 
                ? "bg-white text-slate-900 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Invite</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all font-bold text-[10px]",
              activeTab === 'friends' 
                ? "bg-white text-slate-900 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all font-bold text-[10px]",
              activeTab === 'leaderboard' 
                ? "bg-white text-slate-900 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all font-bold text-[10px]",
              activeTab === 'search' 
                ? "bg-white text-slate-900 shadow-sm font-black" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search ID</span>
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'invite' && (
            <motion.div
              key="invite"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Share Link Card */}
              <div className="bg-slate-900 rounded-[24px] p-5 text-white flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden border border-slate-800">
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full"></div>
                
                <div className="mb-4 relative z-10">
                  <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                    PROMO SYSTEM ACTIVE
                  </span>
                  <h2 className="text-lg font-black tracking-tight mb-1">Invite Friends & Boost Rate</h2>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed mb-4">
                    Get <strong className="text-emerald-400 inline-flex items-center gap-0.5"><USDT amount="+0.02" size="text-[11px]" iconSize="w-3 h-3" />/day</strong> mining boost for every friend who joins! New friends get <strong className="text-emerald-400 inline-flex items-center"><USDT amount="0.7" size="text-[11px]" iconSize="w-3 h-3" /></strong> registration gift!
                  </p>
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
                    <p className="text-xs font-mono truncate text-slate-200">{referralLink}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 relative z-10">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white py-3 rounded-xl font-black transition-colors text-[10px] tracking-wider"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'COPIED!' : 'COPY LINK'}</span>
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white py-3 rounded-xl font-black transition-colors text-[10px] tracking-wider shadow-inner"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>SHARE LINK</span>
                  </motion.button>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-[24px] space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">
                  How the System Works
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center shadow-sm">
                    <span className="text-lg mb-1.5 drop-shadow-sm">📲</span>
                    <span className="text-slate-900 font-black leading-tight">1. Share</span>
                    <span className="text-slate-500 text-[9px] mt-0.5">With friends</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center shadow-sm">
                    <span className="text-lg mb-1.5 drop-shadow-sm">🎁</span>
                    <span className="text-slate-900 font-black leading-tight">2. They Get</span>
                    <span className="text-emerald-600 font-bold text-[9px] mt-0.5 inline-flex items-center gap-0.5"><USDT amount="0.7" size="text-[9px]" iconSize="w-2.5 h-2.5" /> Bonus</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center shadow-sm">
                    <span className="text-lg mb-1.5 drop-shadow-sm">👑</span>
                    <span className="text-slate-900 font-black leading-tight">3. You Get</span>
                    <span className="text-emerald-600 font-bold text-[9px] mt-0.5 inline-flex items-center flex-wrap justify-center gap-0.5"><USDT amount="+0.1" size="text-[9px]" iconSize="w-2.5 h-2.5" /> & Rate</span>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Achievements</h3>
                </div>
                
                <div className="space-y-3">
                  {MILESTONES.map((m) => {
                    const isClaimed = claimedMilestones.includes(m.id);
                    const currentRefs = user?.referralsCount || 0;
                    const isUnlocked = currentRefs >= m.target;
                    const progress = Math.min((currentRefs / m.target) * 100, 100);

                    return (
                      <div key={m.id} className={cn(
                        "bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)] border transition-all duration-300",
                        isClaimed ? "border-emerald-100 bg-emerald-50/20" : "border-slate-100"
                      )}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-[13px] font-black text-slate-900">Invite {m.target} Friends</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase"><USDT amount={'+' + m.rewardUsdt} size="text-[10px]" iconSize="w-3 h-3" /></span>
                              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Pickaxe className="w-3 h-3"/> +{m.rewardRate}/day</span>
                            </div>
                          </div>
                          {isClaimed ? (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                          ) : (
                            <motion.button
                              whileTap={isUnlocked ? { scale: 0.95 } : {}}
                              onClick={() => handleClaimMilestone(m)}
                              disabled={!isUnlocked || claimingMilestone === m.id}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm",
                                isUnlocked 
                                  ? "bg-slate-900 text-white hover:bg-slate-800"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              )}
                            >
                              {claimingMilestone === m.id ? '...' : 'Claim'}
                            </motion.button>
                          )}
                        </div>
                        
                        {!isClaimed && (
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        )}
                        {!isClaimed && <p className="text-[9px] text-right mt-1 font-bold text-slate-400">{currentRefs} / {m.target}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">My Network</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{friends.length}</span>
              </div>

              {friends.length > 0 ? (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                          {friend.username ? friend.username.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">@{friend.username || 'user'}</p>
                          <p className="text-[9px] font-medium text-slate-500">Joined: {new Date(friend.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                        <USDT amount="+0.02" size="text-[10px]" iconSize="w-3 h-3" />/day
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                    <Users className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-xs font-black text-slate-800">No Friends Invited Yet</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                    Invite friends using your unique referral link to build your mining network and claim free bonus <USDT size="text-[10px]" iconSize="w-3 h-3 inline-block -mt-0.5" />!
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Leaderboard Header Card */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-[24px] p-5 text-white flex flex-col shadow-lg relative overflow-hidden border border-amber-400">
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-32 h-32 bg-white/10 blur-2xl rounded-full"></div>
                <div className="flex items-center gap-3 relative z-10 mb-2">
                  <Trophy className="w-8 h-8 text-white animate-bounce" />
                  <div>
                    <h2 className="text-base font-black tracking-tight">Referral Hall of Fame</h2>
                    <p className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Weekly Top Miners</p>
                  </div>
                </div>
                <p className="text-[11px] text-amber-50 font-medium relative z-10 leading-relaxed max-w-xs">
                  Top Miners! Compete with the MINING USDT community and earn exclusive titles and rewards by building an active referral network.
                </p>
              </div>

              {/* Real Leaderboard Data */}
              {loadingLeaderboard ? (
                <div className="bg-white rounded-[24px] p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
                  <p className="text-xs font-black text-slate-500">Loading Leaderboard...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="bg-white rounded-[24px] p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
                    <Trophy className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mb-2 tracking-tight">No Referrals Yet</h3>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                    Be the first to invite friends and top the weekly leaderboard!
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-2">
                  {leaderboard.map((row, index) => {
                    const rank = index + 1;
                    const isTop3 = rank <= 3;
                    const rankColors = [
                      'bg-yellow-500 text-white shadow-[0_2px_8px_rgba(234,179,8,0.3)]',
                      'bg-slate-400 text-white shadow-[0_2px_8px_rgba(148,163,184,0.3)]',
                      'bg-amber-600 text-white shadow-[0_2px_8px_rgba(180,83,9,0.3)]'
                    ];

                    return (
                      <div 
                        key={row.id} 
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl transition-all border",
                          row.isCurrentUser 
                            ? "bg-amber-50/50 border-amber-200/60 shadow-sm" 
                            : "bg-slate-50 border-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                            isTop3 ? rankColors[rank - 1] : "bg-slate-200 text-slate-600"
                          )}>
                            {rank}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-black text-xs text-slate-700 overflow-hidden shrink-0">
                            {row.photoUrl ? (
                              <img src={row.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              (row.username || 'A').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 flex items-center gap-1">
                              <span>{row.firstName || row.username || 'Anonymous'}</span>
                              {row.isCurrentUser && (
                                <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-md">YOU</span>
                              )}
                            </p>
                            <p className="text-[9px] font-medium text-slate-400">@{row.username || 'anonymous'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-black text-slate-900 bg-white border border-slate-200/60 px-2.5 py-1 rounded-lg shadow-sm">
                          <Users className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{row.referralsCount} refs</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Search Card Header */}
              <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Database className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Global Search</h3>
                    <p className="text-[9px] font-bold text-slate-400">FIRESTORE DECENTRALIZED QUERY</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  Query the live Firebase Firestore database to lookup any registered miner profile by their unique Telegram ID instantly.
                </p>

                {/* Form */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      required
                      placeholder="Enter Telegram ID (e.g. 584930219)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-8 text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300"
                    />
                    {searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => { setSearchQuery(''); setSearchResult(null); setSearchError(null); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={searching || !searchQuery.trim()}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
                  >
                    {searching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>SEARCH</span>
                  </motion.button>
                </form>
              </div>

              {/* Search Result Container */}
              <AnimatePresence mode="wait">
                {searching && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/60 rounded-[24px] p-8 border border-slate-100 flex flex-col items-center justify-center space-y-2 text-center"
                  >
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Querying Firestore Server...</p>
                  </motion.div>
                )}

                {searchError && !searching && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-rose-50/50 border border-rose-100 rounded-[24px] p-6 text-center space-y-2"
                  >
                    <span className="text-xl">🔍</span>
                    <h4 className="text-[11px] font-black text-rose-950 uppercase tracking-wider">No Miner Profile Found</h4>
                    <p className="text-[10px] text-rose-800 leading-relaxed font-semibold max-w-xs mx-auto">
                      {searchError}
                    </p>
                  </motion.div>
                )}

                {searchResult && !searching && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 space-y-4"
                  >
                    {/* User Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-black text-sm text-slate-700 overflow-hidden shrink-0 border border-slate-200/50">
                          {searchResult.photoUrl ? (
                            <img src={searchResult.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            (searchResult.firstName || 'M').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1">
                            <span>{searchResult.firstName || 'Anonymous Miner'}</span>
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400">@{searchResult.username || 'anonymous'}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        LIVE SYNCED
                      </span>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mining Speed</p>
                        <div className="flex items-center gap-1">
                          <Pickaxe className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                          <span className="text-[11px] font-black text-slate-800">{(searchResult.miningRate / 100000).toFixed(4)}/d</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Network Connections</p>
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[11px] font-black text-slate-800">{searchResult.referralsCount} invited</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3 col-span-2 flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Miner Balance</p>
                          <USDT amount={formatUSDT(searchResult.totalEarned || 0)} size="text-sm text-slate-900" iconSize="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Firestore Sync ID</p>
                          <span className="text-[9px] font-mono font-black text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">{searchResult.id}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
