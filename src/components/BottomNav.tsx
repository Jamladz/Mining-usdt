import React from 'react';
import { Home, CheckSquare, Users, User, ShieldCheck } from 'lucide-react';
import { cn, isAdminUser } from '../lib/utils';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export function BottomNav({ currentTab, setCurrentTab }: BottomNavProps) {
  const { user } = useApp();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'referrals', icon: Users, label: 'Referrals' },
    { id: 'profile', icon: User, label: 'Profile' }
  ];

  if (isAdminUser(user)) {
    navItems.push({ id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 h-[60px] flex justify-around items-center z-50 pb-[var(--tg-safe-area-inset-bottom,0px)] box-content">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 w-14 transition-colors group relative h-full",
              isActive ? "text-emerald-600" : "text-slate-400 hover:text-emerald-500"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute top-0 w-6 h-0.5 bg-emerald-500 rounded-b-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <motion.div
              animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.05 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
  );
}
