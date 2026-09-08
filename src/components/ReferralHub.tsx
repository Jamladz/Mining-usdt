import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { referralService } from '../services/referralService';
import { REFERRAL_USDT_REWARD, REFERRAL_MINING_BONUS } from '../config/referral';
import { ReferralRecord } from '../types/referral';
import { formatUSDT } from '../lib/utils';
import { motion } from 'motion/react';
import { Users, Copy, Share2, Check, Sparkles, Zap, ArrowUpRight, ShieldCheck, Clock } from 'lucide-react';
import { USDT } from './USDT';

export function ReferralHub() {
  const { user, showToast } = useApp();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = user ? referralService.getReferralLink(user.id) : '';

  useEffect(() => {
    let isMounted = true;
    const loadReferrals = async () => {
      setLoading(true);
      const data = await referralService.getUserReferrals();
      if (isMounted) {
        setReferrals(data);
        setLoading(false);
      }
    };
    loadReferrals();
    return () => { isMounted = false; };
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

  // Stats calculations
  const totalInvited = user?.referralsCount || 0;
  // Calculate referral earnings in USDT (from user.referralEarnings scaled by 10000)
  const earningsUSDT = (user?.referralEarnings || 0) / 10000;
  // Mining boost (+0.01 per referral)
  const miningBoostTotal = totalInvited * REFERRAL_MINING_BONUS;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Rewards Program</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Invite Friends & Earn</h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
            Get <strong className="text-emerald-400 font-extrabold">+${REFERRAL_USDT_REWARD.toFixed(2)} USDT</strong> cash reward and <strong className="text-emerald-400 font-extrabold">+{REFERRAL_MINING_BONUS.toFixed(2)} Mining Speed</strong> boost for every verified friend!
          </p>
        </div>
      </div>

      {/* Real-time Stats Dashboard */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Friends Invited */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Invited</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">{totalInvited}</p>
            <p className="text-[10px] font-bold text-slate-400">Friends</p>
          </div>
        </div>

        {/* Referral Earnings */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Earnings</span>
            <USDT amount="0" size="text-xs" iconSize="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-600">${earningsUSDT.toFixed(2)}</p>
            <p className="text-[10px] font-bold text-slate-400">USDT Earned</p>
          </div>
        </div>

        {/* Mining Boost */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Boost</span>
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-600">+{miningBoostTotal.toFixed(2)}</p>
            <p className="text-[10px] font-bold text-slate-400">Rate Boost</p>
          </div>
        </div>
      </div>

      {/* Referral Link & Actions */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">Your Referral Link</h2>
          <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Guaranteed Reward
          </span>
        </div>

        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-mono text-slate-700 truncate">
          <span className="truncate select-all">{referralLink}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCopy}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-slate-900/10"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Share on Telegram</span>
          </motion.button>
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">Invited Friends History</h2>
            <p className="text-[11px] font-semibold text-slate-400">Successful referrals connected to your account</p>
          </div>
          <span className="text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {referrals.length}
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-emerald-500" /> Loading referrals...
          </div>
        ) : referrals.length === 0 ? (
          <div className="py-10 text-center space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black text-slate-700">No Friends Invited Yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Share your referral link with friends on Telegram to start earning instant +0.10 USDT and mining boosts!
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
                    {item.referredName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-900">{item.referredName}</p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-black text-emerald-600">+${(item.rewardUSDT / 10000).toFixed(2)} USDT</span>
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                      +{(item.miningBonus / 10000).toFixed(2)} Speed
                    </span>
                  </div>
                  <div className="flex items-center gap-1 justify-end text-[10px] font-extrabold text-emerald-600">
                    <Check className="w-3 h-3" /> Completed
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
