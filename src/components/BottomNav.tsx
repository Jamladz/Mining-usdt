import React from 'react';
import { Home, CheckSquare, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function BottomNav({ currentTab, setCurrentTab }: BottomNavProps) {
  const { user } = useApp();

  const getInitials = () => {
    if (!user) return 'US';
    const name = user.username || user.firstName || 'User';
    // Clean and split
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (!cleanName) {
      // Fallback for non-latin or empty
      const rawName = name.trim();
      return rawName.length >= 2 ? rawName.slice(0, 2).toUpperCase() : 'US';
    }
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'referrals', icon: Users, label: 'Referrals' }
  ];

  const isProfileActive = currentTab === 'profile';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md flex items-center gap-3 z-50">
      {/* 1. Rectangle containing Home, Tasks, and Referrals */}
      <div className="flex-1 bg-white/95 backdrop-blur-md border border-slate-200/85 px-2 h-[64px] rounded-2xl flex justify-around items-center shadow-[0_12px_36px_rgba(0,0,0,0.12)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-14 transition-all duration-300 group relative h-full",
                isActive ? "text-emerald-600" : "text-slate-400 hover:text-emerald-500"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-1 w-6 h-0.5 bg-emerald-500 rounded-b-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.05 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex items-center justify-center min-h-[24px]"
              >
                <Icon className="w-5 h-5 mt-0.5" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={cn("text-[9px] font-black uppercase tracking-tighter", isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Profile icon button, same height as the rectangle, outside of it - as a perfect circle */}
      <button
        onClick={() => setCurrentTab('profile')}
        className={cn(
          "w-[64px] h-[64px] shrink-0 rounded-full border flex items-center justify-center transition-all duration-300 relative shadow-[0_12px_36px_rgba(0,0,0,0.12)] backdrop-blur-md group",
          isProfileActive
            ? "bg-emerald-600 border-emerald-500 text-white"
            : "bg-white/95 border-slate-200/85 text-slate-700 hover:text-emerald-600 hover:border-emerald-200/50"
        )}
      >
        <div className={cn(
          "w-full h-full rounded-full flex items-center justify-center text-[15px] font-black tracking-normal transition-all",
          isProfileActive
            ? "bg-emerald-600 text-white shadow-inner"
            : "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"
        )}>
          {getInitials()}
        </div>
      </button>
    </div>
  );
}
