import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { useApp } from '../context/AppContext';
import { USDT } from "./USDT";
import { 
  Users, 
  Copy, 
  Share2, 
  Pickaxe, 
  CheckCircle2, 
  Gift, 
  Trophy, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { formatUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { referralService } from '../services/referralService';
import { REFERRAL_MILESTONES, WELCOME_REFERRAL_REWARD, REFERRER_REWARD } from '../config/referral';
import { ReferralRecord } from '../types';

export function ReferralHub() {
  const { user, setUser, isAuthCompleted, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<ReferralRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invite' | 'friends' | 'leaderboard'>('invite');
  
  const referralLink = user ? referralService.getReferralLink(user.id) : '';

  useEffect(() => {
    const loadData = async () => {
      if (isAuthCompleted) {
        const refs = await referralService.getUserReferrals();
        setFriends(refs);
      }
    };
    loadData();
  }, [isAuthCompleted]);

  useEffect(() => {
    if (activeTab === 'leaderboard' && isAuthCompleted) {
      const loadLeaderboard = async () => {
        setLoadingLeaderboard(true);
        const lb = await referralService.getReferralLeaderboard();
        setLeaderboard(lb);
        setLoadingLeaderboard(false);
      };
      loadLeaderboard();
    }
  }, [activeTab, isAuthCompleted]);

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
    showToast('📋 Referral link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!user) return;
    const shareUrl = await referralService.getShareTelegramLink(user.id);
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleClaimMilestone = async (m: any) => {
    if (claimingMilestone || claimedMilestones.includes(m.id)) return;
    
    if ((user?.referralsCount || 0) < m.targetCount) return;
    
    setClaimingMilestone(m.id);
    try {
      const data = await referralService.claimReferralMilestone(m.id);
      if (data.success && data.user) {
        setUser(data.user);
        showToast(`🎉 Reward Claimed: +${m.rewardCoins} coins & +${m.rewardVipDays} VIP days!`, 'success');
      } else {
        showToast(data.error || 'Failed to claim milestone', 'error');
      }
    } catch (e) {
      showToast('Connection error', 'error');
    } finally {
      setClaimingMilestone(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7F9]">
      <Header title="Referral Hub" />
      
      <div className="p-4 space-y-4 pb-24">
        {/* Stats Card */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Invited Friends</p>
            <p className="text-2xl font-black text-slate-900">{user?.referralsCount || 0}</p>
          </div>
          <div className="bg-emerald-50 rounded-[20px] p-4 shadow-sm border border-emerald-100">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Earned</p>
            <USDT amount={formatUSDT(user?.earnedReferralCoins || 0)} size="text-2xl text-emerald-700" iconSize="w-5 h-5" className="font-black" />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-200/60 p-1 rounded-2xl flex gap-1">
          {(['invite', 'friends', 'leaderboard'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'invite' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="bg-slate-900 rounded-[24px] p-5 text-white shadow-lg border border-slate-800">
                <h2 className="text-lg font-black mb-1">Invite & Earn</h2>
                <p className="text-[11px] text-slate-300 mb-4">
                  Earn <span className="text-emerald-400">+{formatUSDT(REFERRER_REWARD)} USDT</span> for every friend! 
                  They get <span className="text-emerald-400">+{formatUSDT(WELCOME_REFERRAL_REWARD)} USDT</span> welcome bonus.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex-1 bg-white/10 py-3 rounded-xl font-black text-[10px]">{copied ? 'COPIED!' : 'COPY'}</button>
                  <button onClick={handleShare} className="flex-1 bg-emerald-500 py-3 rounded-xl font-black text-[10px]">SHARE</button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Milestones</h3>
                {REFERRAL_MILESTONES.map((m) => {
                  const isClaimed = claimedMilestones.includes(m.id);
                  const isUnlocked = (user?.referralsCount || 0) >= m.targetCount;
                  return (
                    <div key={m.id} className="bg-white p-4 rounded-[20px] border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-black">Invite {m.targetCount} Friends</p>
                        <p className="text-[10px] text-emerald-600 font-bold">+{m.rewardCoins} coins & +{m.rewardVipDays} VIP days</p>
                      </div>
                      {isClaimed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <button 
                          onClick={() => handleClaimMilestone(m)}
                          disabled={!isUnlocked || claimingMilestone === m.id}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase",
                            isUnlocked ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                          )}
                        >
                          {claimingMilestone === m.id ? '...' : 'Claim'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-[24px] p-5 border border-slate-100 min-h-[200px]">
              {friends.length > 0 ? (
                <div className="space-y-3">
                  {friends.map((f) => (
                    <div key={f.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-black">@{f.referredName || 'user'}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">+{REFERRER_REWARD} coins</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Users className="w-8 h-8 mb-2" />
                  <p className="text-xs font-black">No friends yet</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2">
              {loadingLeaderboard ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : (
                leaderboard.map((row, i) => (
                  <div key={row.id} className={cn("flex justify-between items-center p-4 rounded-xl border", row.isCurrentUser ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100")}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-400 w-4">{i + 1}</span>
                      <p className="text-xs font-black">{row.firstName || row.username}</p>
                    </div>
                    <span className="text-xs font-black">{row.referralsCount} refs</span>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
