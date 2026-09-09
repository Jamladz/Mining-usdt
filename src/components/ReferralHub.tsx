import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { referralService, REFERRAL_MILESTONES, Milestone } from '../services/referralService';
import { ReferralRecord } from '../types/referral';
import { formatUSDT } from '../lib/utils';
import { USDT } from './USDT';
import { motion } from 'motion/react';
import { Users, Copy, Share2, Check, Sparkles, Trophy, Gift, Clock, AlertCircle, TrendingUp } from 'lucide-react';

export function ReferralHub() {
  const { user, setUser, fetchUser, showToast } = useApp();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);

  const referralLink = user ? referralService.getReferralLink(user.id) : '';

  const loadReferrals = async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await referralService.getUserReferrals(user.id);
    setReferrals(data);
    setLoading(false);
  };

  useEffect(() => {
    loadReferrals();
  }, [user?.id, user?.referralsCount]);

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showToast('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
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

  const handleClaimMilestone = async (target: number) => {
    if (!user?.id) return;
    setClaimingMilestone(target);
    try {
      const res = await referralService.claimMilestone(user.id, target);
      if (res.success) {
        showToast(res.message, 'success');
        
        // Update user local state
        const claimedMilestones = (user as any).claimedMilestones || [];
        const updatedUser = {
          ...user,
          claimedMilestones: [...claimedMilestones, target],
          balance: (user.balance || 0) + res.rewardUSDT,
          miningRate: (user.miningRate || 0) + res.rewardMiningRate
        };
        setUser(updatedUser);
        
        // Fetch fresh state from SQL/Express backend
        await fetchUser();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error claiming milestone reward', 'error');
    } finally {
      setClaimingMilestone(null);
    }
  };

  const totalInvited = user?.referralsCount || 0;
  const earningsUSDTUnits = user?.referralEarnings || 0;
  const claimedMilestones: number[] = (user as any)?.claimedMilestones || [];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24 text-left" dir="ltr">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Instant USDT & Rate Boosts</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Invite & Earn</h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
            Receive <strong className="text-emerald-400 font-extrabold">+0.10 USDT</strong> and a permanent <strong className="text-emerald-400 font-extrabold">+0.01 USDT/24h Mining Speed boost</strong> for every friend you refer!
          </p>
        </div>
      </div>

      {/* Real-time Stats Dashboard */}
      <div className="grid grid-cols-2 gap-3">
        {/* Friends Invited */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Referred</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{totalInvited}</p>
            <p className="text-[10px] font-bold text-slate-400">Active Friends</p>
          </div>
        </div>

        {/* Referral Earnings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Referral Profit</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 flex items-center gap-1">
              <USDT amount={formatUSDT(earningsUSDTUnits)} size="text-2xl" iconSize="w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold text-slate-400">USDT Earned</p>
          </div>
        </div>
      </div>

      {/* Referral Link & Actions */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">Your Invite Link</h2>
          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
            Guaranteed Reward ✨
          </span>
        </div>

        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-700 truncate" dir="ltr">
          <span className="truncate select-all w-full text-left">{referralLink}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCopy}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 mr-1" /> : <Copy className="w-4 h-4 text-slate-600 mr-1" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-slate-900/10"
          >
            <Share2 className="w-4 h-4 text-emerald-400 mr-1" />
            <span>Share on Telegram</span>
          </motion.button>
        </div>
      </div>

      {/* Milestone Stages and Rewards */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-emerald-500" />
            <span>Referral Milestone Tiers</span>
          </h2>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Reach invites targets to unlock high-value USDT & Speed boosts!</p>
        </div>

        <div className="space-y-3">
          {REFERRAL_MILESTONES.map((milestone) => {
            const isClaimed = claimedMilestones.includes(milestone.target);
            const isClaimable = totalInvited >= milestone.target && !isClaimed;
            const progressPercent = Math.min((totalInvited / milestone.target) * 100, 100);

            return (
              <div 
                key={milestone.target}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5 transition-all hover:bg-slate-50/80"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-900">{milestone.description}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      Target: {milestone.target} friends ({totalInvited} invited)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-emerald-600 flex items-center gap-0.5 justify-end">
                      +{milestone.rewardUSDTUnits / 10000} USDT
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5 justify-end">
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                      +{milestone.rewardMiningUnits / 10000}/24h Rate
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-1">
                  {isClaimed ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 mr-0.5" /> Claimed Successfully
                    </span>
                  ) : isClaimable ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleClaimMilestone(milestone.target)}
                      disabled={claimingMilestone === milestone.target}
                      className="text-[10px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                    >
                      {claimingMilestone === milestone.target ? (
                        <Clock className="w-3 h-3 animate-spin mr-0.5" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-0.5 text-white animate-pulse" />
                      )}
                      <span>Claim Reward</span>
                    </motion.button>
                  ) : (
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                      Locked ({milestone.target - totalInvited} left)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Referred Friends</h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">List of users who registered with your link</p>
          </div>
          <span className="text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {referrals.length}
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-emerald-500 mr-1" /> Loading history...
          </div>
        ) : referrals.length === 0 ? (
          <div className="py-10 text-center space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-700">No friends referred yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Share your invitation link on Telegram to start earning instant rewards and permanent speed boosts!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {referrals.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
                    {item.referredName ? item.referredName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-900 text-left">{item.referredName}</p>
                    <p className="text-[10px] font-semibold text-slate-400 text-left">
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="font-black text-emerald-600 flex items-center gap-0.5 justify-end">
                    <USDT amount={formatUSDT(item.rewardUSDT || 1000)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1 justify-end text-[10px] font-extrabold text-emerald-600">
                    <Check className="w-3 h-3 mr-0.5" /> Registered
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
