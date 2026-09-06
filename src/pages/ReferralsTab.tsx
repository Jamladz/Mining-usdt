import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { USDT } from "../components/USDT";
import { Users, Copy, Share2, ArrowRight } from 'lucide-react';
import { formatUSDT } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ReferralsTab() {
  const { user } = useApp();
  const [copied, setCopied] = useState(false);
  
  const referralLink = `https://t.me/Miningusdt2027_bot?start=ref_${user?.id || 'ref'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (user?.openTelegramLink) {
      user.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join USDT Miner and earn free USDT daily!')}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join USDT Miner and earn free USDT daily!')}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7F9]">
      <Header title="Referrals" />
      
      <div className="p-4 space-y-4 pb-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center flex flex-col items-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[150px] -z-0 opacity-50"></div>
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3 relative z-10 shadow-inner"
          >
            <Users className="w-6 h-6 text-emerald-600" />
          </motion.div>
          
          <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-1 relative z-10">Invite & Grow</h2>
          <p className="text-xs text-slate-500 font-medium px-4 relative z-10">
            Invite friends to increase your mining power.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Invited Friends</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{user?.referralsCount || 0}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[20px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col"
          >
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Bonus Earned</p>
            <div className="flex items-center gap-1 min-w-0 w-full">
              <USDT amount={formatUSDT(user?.referralBonusEarned || 0)} size="text-xl sm:text-2xl text-emerald-600" iconSize="w-5 h-5 sm:w-6 sm:h-6" className="truncate" />
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900 rounded-[24px] p-5 text-white flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative overflow-hidden"
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full"></div>
          
          <div className="mb-4 relative z-10">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Referral Link</p>
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
              <span>{copied ? 'COPIED!' : 'COPY'}</span>
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
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3 px-1">How it works</h3>
          
          <div className="flex gap-2">
            <div className="flex-1 bg-white p-3 rounded-[16px] border border-slate-100 flex flex-col items-center text-center shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-[10px] mb-2">1</div>
              <h4 className="font-bold text-slate-900 text-[11px] mb-1">Invite</h4>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Share link</p>
            </div>
            <div className="flex-1 bg-white p-3 rounded-[16px] border border-slate-100 flex flex-col items-center text-center shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px] mb-2">2</div>
              <h4 className="font-bold text-slate-900 text-[11px] mb-1">Join</h4>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Friend joins</p>
            </div>
            <div className="flex-1 bg-white p-3 rounded-[16px] border border-slate-100 flex flex-col items-center text-center shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px] mb-2">3</div>
              <h4 className="font-bold text-slate-900 text-[11px] mb-1">Earn</h4>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Grow together</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
