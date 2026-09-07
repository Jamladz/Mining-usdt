import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { Users, Copy, Share2, ArrowRight, Pickaxe, CheckCircle2, Gift } from 'lucide-react';
import { formatUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function ReferralsTab() {
  const { user, setUser, initData } = useApp();
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [claimingMilestone, setClaimingMilestone] = useState<string | null>(null);
  
  const referralLink = `https://t.me/Miningusdt2027_bot?startapp=${user?.id || 'demo123'}`;

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

  useEffect(() => {
    fetchReferrals();
  }, [initData]);

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
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = 'Join USDT Miner and earn free USDT daily! 🚀💎';
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
          referralsCount: currentRefs // Preserve local count which is appended on auth
        });
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.warn('Simulation mode for claiming milestone');
      if (user) {
        const newClaimed = [...claimedMilestones, m.id];
        setUser({
          ...user,
          balance: (user.balance || 0) + (m.rewardUsdt * 10000), // Scale
          miningRate: (user.miningRate || 0) + (m.rewardRate * 10000), // Scale
          claimedMilestones: JSON.stringify(newClaimed)
        });
      }
    } finally {
      setClaimingMilestone(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7F9]">
      <Header title="Referrals" />
      
      <div className="p-4 space-y-4 pb-12">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Invited Friends</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{user?.referralsCount || 0}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-emerald-50 rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-emerald-100 flex flex-col"
          >
            <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1 tracking-widest">Earned Bonus</p>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.referralBonusEarned || 0)} size="text-xl sm:text-2xl text-emerald-700" iconSize="w-4 h-4 sm:w-5 sm:h-5" className="truncate" />
            </div>
          </motion.div>
        </div>

        {/* Share Link Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 rounded-[24px] p-5 text-white flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden"
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full"></div>
          
          <div className="mb-4 relative z-10">
            <h2 className="text-lg font-black tracking-tight mb-1">Invite Friends & Boost Rate</h2>
            <p className="text-[11px] text-slate-300 font-medium leading-relaxed mb-4">
              Get <strong className="text-emerald-400">+0.02 USDT/day</strong> mining boost for every friend who joins! New friends get <strong className="text-emerald-400">0.7 USDT</strong> registration gift!
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
              <span>SHARE</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Milestones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <Gift className="w-4 h-4 text-emerald-600" />
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Achievements</h3>
          </div>
          
          <div className="space-y-3">
            {MILESTONES.map((m, i) => {
              const isClaimed = claimedMilestones.includes(m.id);
              const currentRefs = user?.referralsCount || 0;
              const isUnlocked = currentRefs >= m.target;
              const progress = Math.min((currentRefs / m.target) * 100, 100);

              return (
                <div key={m.id} className={cn(
                  "bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)] border",
                  isClaimed ? "border-emerald-100 bg-emerald-50/30" : "border-slate-100"
                )}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-[13px] font-black text-slate-900">Invite {m.target} Friends</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">+{m.rewardUsdt} USDT</span>
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
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
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
        </motion.div>

        {/* Friends List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-800" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">My Friends</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{friends.length}</span>
          </div>

          {friends.length > 0 ? (
            <div className="space-y-3">
              {friends.map((friend, i) => (
                <div key={friend.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">@{friend.username}</p>
                      <p className="text-[9px] font-medium text-slate-500">{new Date(friend.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    +0.02 USDT/day
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400">You haven't invited anyone yet.</p>
              <p className="text-[10px] font-medium text-slate-400 mt-1">Share your link to start earning!</p>
            </div>
          )}
        </motion.div>
        
      </div>
    </div>
  );
}
