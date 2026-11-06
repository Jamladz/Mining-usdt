import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { useApp } from '../context/AppContext';
import { referralService, REFERRAL_MILESTONES } from '../services/referralService';
import { ReferralRecord } from '../types/referral';
import { formatUSDT } from '../lib/utils';
import { USDT } from './USDT';
import { motion } from 'motion/react';
import { Users, Copy, Share2, Check, Sparkles, Trophy, Gift, Clock, AlertCircle, TrendingUp, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';

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
        
        const claimedMilestones = (user as any).claimedMilestones || [];
        const updatedUser = {
          ...user,
          claimedMilestones: [...claimedMilestones, target],
          balance: (user.balance || 0) + res.rewardUSDT,
          miningRate: (user.miningRate || 0) + res.rewardMiningRate
        };
        setUser(updatedUser);
        
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

  const totalInvited = Math.max(user?.referralsCount || 0, referrals.length);
  const earningsUSDTUnits = Math.max(user?.referralEarnings || 0, referrals.length * 1000);
  const claimedMilestones: number[] = (user as any)?.claimedMilestones || [];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F4F6F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]" dir="ltr">
      <Header title="Referrals" />

      <div className="p-4 space-y-4 pb-28 max-w-md mx-auto text-left">
        {/* Executive Invite & Earn Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.16)]"
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-12 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                Partner Referral Program
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-300 inline-flex items-center gap-1">
                <USDT amount="+0.10" size="text-[11px] text-white" iconSize="w-3.5 h-3.5" />
                <span>/ Invite</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Invite Friends & Multiply Yield
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Earn <span className="inline-flex items-center align-middle mx-0.5"><USDT amount="+0.10" size="text-xs text-emerald-400 font-bold" iconSize="w-3.5 h-3.5" /></span> instantly plus a permanent <span className="inline-flex items-center align-middle mx-0.5"><USDT amount="+0.01" size="text-xs text-emerald-400 font-bold" iconSize="w-3.5 h-3.5" /></span>/24h mining boost for every active friend who joins.
            </p>
          </div>

          {/* Integrated Referral Telemetry Strip */}
          <div className="relative z-10 mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-sky-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block">Active Friends</span>
                <span className="text-base font-black text-white font-mono tabular-nums">
                  {totalInvited}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-l border-white/10 pl-3">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block">Referral Profit</span>
                <div className="text-base font-black text-white font-mono tabular-nums flex items-center gap-1 mt-0.5">
                  <USDT amount={formatUSDT(earningsUSDTUnits)} size="text-base text-white" iconSize="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Referral Link & Share Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-white rounded-[28px] p-5 border border-slate-200/70 shadow-[0_10px_35px_rgba(15,23,42,0.04)] space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">Personal Invite Link</h2>
              <p className="text-[11px] font-medium text-slate-400">Share directly on Telegram or copy link</p>
            </div>
            <span className="text-[11px] font-bold text-emerald-600">
              Instant Credit
            </span>
          </div>

          <div
            onClick={handleCopy}
            className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl px-3.5 py-3 text-xs font-mono text-slate-700 cursor-pointer transition-colors"
            dir="ltr"
          >
            <span className="truncate select-all w-full text-left">{referralLink}</span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className="h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200/80 whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleShare}
              className="h-11 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors shadow-[0_6px_16px_rgba(15,23,42,0.12)] whitespace-nowrap"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Share on Telegram</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Milestone Stages and Rewards */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-[28px] p-5 border border-slate-200/70 shadow-[0_10px_35px_rgba(15,23,42,0.04)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Milestone Bonus Tiers</h2>
                <p className="text-[11px] font-medium text-slate-400">Unlock extra USDT & permanent speed boosts</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {REFERRAL_MILESTONES.map((milestone) => {
              const isClaimed = claimedMilestones.includes(milestone.target);
              const isClaimable = totalInvited >= milestone.target && !isClaimed;
              const progressPercent = Math.min((totalInvited / milestone.target) * 100, 100);

              return (
                <div 
                  key={milestone.target}
                  className={cn(
                    "p-4 rounded-2xl border space-y-2.5 transition-all",
                    isClaimable
                      ? "bg-emerald-50/40 border-emerald-300"
                      : "bg-slate-50/80 border-slate-200/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-slate-900">{milestone.description}</p>
                      <p className="text-[10px] font-semibold text-slate-400 font-mono tabular-nums mt-0.5">
                        Progress: {Math.min(totalInvited, milestone.target)} / {milestone.target} friends
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0 flex flex-col items-end">
                      <div className="text-xs font-black text-emerald-600 flex items-center gap-1">
                        <USDT amount={'+' + (milestone.rewardUSDTUnits / 10000).toFixed(2)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 justify-end mt-0.5">
                        <USDT amount={'+' + (milestone.rewardMiningUnits / 10000).toFixed(2)} size="text-[10px] text-slate-600 font-bold" iconSize="w-3 h-3" />
                        <span>/24h</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Status / Action Row */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {isClaimed
                        ? 'Reward credited to account'
                        : isClaimable
                          ? 'Target reached — ready to claim'
                          : `${milestone.target - totalInvited} more ${milestone.target - totalInvited === 1 ? 'friend' : 'friends'} needed`}
                    </span>

                    {isClaimed ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Claimed
                      </span>
                    ) : isClaimable ? (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleClaimMilestone(milestone.target)}
                        disabled={claimingMilestone === milestone.target}
                        className="text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1"
                      >
                        {claimingMilestone === milestone.target ? (
                          <Clock className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-white" />
                        )}
                        <span>Claim Bonus</span>
                      </motion.button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 font-mono tabular-nums">
                        {Math.round(progressPercent)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Referred Friends List */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white rounded-[28px] p-5 border border-slate-200/70 shadow-[0_10px_35px_rgba(15,23,42,0.04)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Referred Friends</h2>
                <p className="text-[10px] font-medium text-slate-400">Friends registered via your link</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono tabular-nums">
              {referrals.length} {referrals.length === 1 ? 'friend' : 'friends'}
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-emerald-600" /> Loading referrals...
            </div>
          ) : referrals.length === 0 ? (
            <div className="py-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-5">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-700">No friends referred yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Share your invite link on Telegram to earn instant USDT and boost your daily mining speed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {referrals.map((item) => (
                <div 
                  key={item.id} 
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                      {item.referredName ? item.referredName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-left truncate">{item.referredName}</p>
                      <p className="text-[10px] font-medium text-slate-400 text-left mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-black text-emerald-600 flex items-center gap-0.5 justify-end">
                      <span>+</span>
                      <USDT amount={formatUSDT(item.rewardUSDT || 1000)} size="text-xs text-emerald-600 font-black" iconSize="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      Verified
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

