/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { HomeTab } from './pages/HomeTab';
import { TasksTab } from './pages/TasksTab';
import { ReferralsTab } from './pages/ReferralsTab';
import { ProfileTab } from './pages/ProfileTab';
import { AnimatePresence, motion } from 'motion/react';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('home');
  const { user } = useApp();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F7F9] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <img src="https://i.ibb.co/HLT6ZFck/file-00000000a24c81f4a775591b812d2228.png" alt="Mining usdt" className="w-24 h-24 object-contain drop-shadow-2xl" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[var(--tg-viewport-stable-height,100dvh)] bg-[#F5F7F9] text-slate-900 pt-[var(--tg-safe-area-inset-top,0px)] pb-[calc(60px+var(--tg-safe-area-inset-bottom,0px))] font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      <main className="w-full flex-1 overflow-y-auto overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          {currentTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <HomeTab />
            </motion.div>
          )}
          {currentTab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <TasksTab />
            </motion.div>
          )}
          {currentTab === 'referrals' && (
            <motion.div key="referrals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ReferralsTab />
            </motion.div>
          )}
          {currentTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ProfileTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
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
