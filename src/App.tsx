/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { HomeTab } from './pages/HomeTab';
import { TasksTab } from './pages/TasksTab';
import { ReferralHub } from './components/ReferralHub';
import { ProfileTab } from './pages/ProfileTab';
import { WelcomeBonusSheet } from './components/WelcomeBonusSheet';
import { AnimatePresence, motion } from 'motion/react';
import { referralService } from './services/referralService';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const { user, setUser, showToast } = useApp();

  useEffect(() => {
    if (user && user.id) {
      const handleReferral = async () => {
        try {
          const res = await referralService.processReferral(
            user.id,
            user.firstName || 'Friend',
            user.username || ''
          );
          if (res && res.success) {
            showToast(
              <div className="flex flex-col gap-0.5 text-left" dir="ltr">
                <span className="text-[13px] font-black text-emerald-200">🎉 Referral Reward Claimed!</span>
                <span className="text-[11px] font-bold text-white opacity-90">
                  You successfully joined via {res.referrerName}'s invite link and received +0.10 USDT!
                </span>
              </div>,
              'success'
            );
            setUser(prev => prev ? {
              ...prev,
              balance: (prev.balance || 0) + (res.rewardAmount || 0)
            } : null);
          }
        } catch (e) {
          console.error('[App] Failed to process referral deep link:', e);
        }
      };
      handleReferral();
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <img src="https://i.ibb.co/HLT6ZFck/file-00000000a24c81f4a775591b812d2228.png" alt="MINING USDT" className="w-24 h-24 object-contain drop-shadow-2xl" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[var(--tg-viewport-stable-height,100dvh)] bg-[#F5F7F9] text-slate-900 pt-[var(--tg-safe-area-inset-top,0px)] pb-[calc(60px+var(--tg-safe-area-inset-bottom,0px))] font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <main className="w-full flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {currentTab === 'home' && (
            <motion.div key="home" className="flex flex-col h-full overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <HomeTab />
            </motion.div>
          )}
          {currentTab === 'tasks' && (
            <motion.div key="tasks" className="flex flex-col h-full overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <TasksTab />
            </motion.div>
          )}
          {currentTab === 'referrals' && (
            <motion.div key="referrals" className="flex flex-col h-full overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ReferralHub />
            </motion.div>
          )}
          {currentTab === 'profile' && (
            <motion.div key="profile" className="flex flex-col h-full overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ProfileTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <WelcomeBonusSheet />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
