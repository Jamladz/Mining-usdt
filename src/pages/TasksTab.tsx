import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { USDT } from '../components/USDT';
import { useApp } from '../context/AppContext';
import { Play, CheckCircle2, MonitorPlay, MousePointerClick, Smartphone, Globe, Gift, BookmarkPlus } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Task {
  id: string;
  title: string;
  provider: 'monetag' | 'adsgram' | 'system';
  icon: React.ReactNode;
  rewardValue?: string;
  action?: () => void;
}

export function TasksTab() {
  const { user, setUser, fetchUser, initData, addToHomeScreen, homeScreenStatus, canAddToHomeScreen } = useApp();
  const [completedTasksList, setCompletedTasksList] = useState<{ taskId: string; completedAt: number }[]>([]);
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    if (user?.completedTasks) {
      try {
        const parsed = JSON.parse(user.completedTasks);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(item => {
            if (typeof item === 'string') {
              // Backward compatibility: assume completed 12 hours ago
              return { taskId: item, completedAt: Date.now() - 12 * 60 * 60 * 1000 };
            }
            return item;
          });
          setCompletedTasksList(normalized);
        } else {
          setCompletedTasksList([]);
        }
      } catch (e) {
        console.error('Failed to parse completed tasks:', e);
        setCompletedTasksList([]);
      }
    } else {
      setCompletedTasksList([]);
    }
  }, [user]);

  // Tick timer every second to update countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getTaskStatus = (taskId: string) => {
    if (taskId === 'sys_add_home' && homeScreenStatus === 'added') {
      return { isCompleted: true, timeLeft: 24 * 60 * 60 * 1000 }; // Permanently completed or large cooldown
    }
    const record = completedTasksList.find(t => t.taskId === taskId);
    if (!record) return { isCompleted: false, timeLeft: 0 };
    
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const elapsed = currentTime - record.completedAt;
    const timeLeft = Math.max(0, ONE_DAY - elapsed);
    
    return {
      isCompleted: timeLeft > 0,
      timeLeft
    };
  };

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTaskClick = async (task: Task) => {
    const { isCompleted } = getTaskStatus(task.id);
    if (loadingTask || isCompleted) return;
    
    // Execute custom action if provided (like addToHomeScreen)
    if (task.action) {
      task.action();
    }

    setLoadingTask(task.id);
    
    setTimeout(async () => {
      const completionObj = { taskId: task.id, completedAt: Date.now() };
      try {
        const res = await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': initData || ''
          },
          body: JSON.stringify({ taskId: task.id, provider: task.provider })
        });
        
        const data = await res.json();
        if (data.success) {
          // Update local state directly with timestamp
          const updatedList = [...completedTasksList.filter(c => c.taskId !== task.id), completionObj];
          setCompletedTasksList(updatedList);
          
          if (user) {
            setUser({
              ...user,
              miningRate: data.newRate || user.miningRate,
              completedTasks: JSON.stringify(updatedList)
            });
          }
          await fetchUser();
        } else {
          alert(data.error || 'Failed to complete task');
        }
      } catch (e) {
        console.warn('Backend not available, using local simulation for task completion');
        const updatedList = [...completedTasksList.filter(c => c.taskId !== task.id), completionObj];
        setCompletedTasksList(updatedList);
        
        if (user) {
          const rewardRateBoost = task.id === 'sys_add_home' ? 500 : 100;
          setUser({ 
            ...user, 
            balance: (user.balance || 0) + 100, // +0.01 USDT
            miningRate: (user.miningRate || 0) + rewardRateBoost,
            completedTasks: JSON.stringify(updatedList)
          });
        }
      } finally {
        setLoadingTask(null);
      }
    }, 2000); // Simulate task delay
  };

  const monetagTasks: Task[] = [
    { id: 'monetag_1', title: 'Watch Premium Ad', provider: 'monetag', icon: <MonitorPlay className="w-5 h-5" /> },
    { id: 'monetag_2', title: 'Click Offer', provider: 'monetag', icon: <MousePointerClick className="w-5 h-5" /> }
  ];

  const adsgramTasks: Task[] = [
    { id: 'adsgram_1', title: 'View Sponsored Video', provider: 'adsgram', icon: <Smartphone className="w-5 h-5" /> },
    { id: 'adsgram_2', title: 'Visit Partner Website', provider: 'adsgram', icon: <Globe className="w-5 h-5" /> }
  ];

  const sysTasks: Task[] = [
    { id: 'sys_daily', title: 'Daily Check-in', provider: 'system', icon: <Gift className="w-5 h-5" /> },
    { 
      id: 'sys_add_home', 
      title: 'Add to Home Screen', 
      provider: 'system', 
      icon: <BookmarkPlus className="w-5 h-5" />,
      rewardValue: '0.05',
      action: addToHomeScreen
    }
  ];

  // Filter out the home screen task if it's explicitly unsupported and not already completed
  const activeSysTasks = sysTasks.filter(t => {
    const { isCompleted } = getTaskStatus(t.id);
    if (t.id === 'sys_add_home' && homeScreenStatus === 'unsupported' && !isCompleted) {
      return false; // Hide if completely unsupported on their device
    }
    return true;
  });

  const renderTask = (task: Task, index: number) => {
    const { isCompleted, timeLeft } = getTaskStatus(task.id);
    const isLoading = loadingTask === task.id;
    const reward = task.rewardValue || '0.01';
    
    return (
      <motion.div 
        key={task.id} 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          "flex items-center justify-between p-3 rounded-2xl border mb-2 transition-all",
          isCompleted ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.04)]"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", 
            isCompleted ? "bg-slate-100 text-slate-400" : 
            task.provider === 'monetag' ? "bg-indigo-50 text-indigo-500" : 
            task.provider === 'adsgram' ? "bg-blue-50 text-blue-500" : 
            "bg-emerald-50 text-emerald-500"
          )}>
            {React.cloneElement(task.icon as React.ReactElement, { className: "w-4 h-4" })}
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <p className={cn("text-[13px] font-bold truncate tracking-tight", isCompleted ? "text-slate-400" : "text-slate-900")}>{task.title}</p>
            <p className={cn("text-[9px] font-bold uppercase tracking-widest flex items-center gap-1", isCompleted ? "text-slate-400" : "text-emerald-600")}>
              +{reward} <USDT size="text-[9px]" iconSize="w-3 h-3" /> / 24H
            </p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {isCompleted ? (
            <motion.div 
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-end gap-0.5"
            >
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-black text-[9px] border border-emerald-100/50">
                <CheckCircle2 className="w-3 h-3" />
                <span>DONE</span>
              </div>
              {task.id !== 'sys_add_home' && timeLeft > 0 && (
                <span className="text-[8px] font-mono font-bold text-slate-400">Resets in {formatCountdown(timeLeft)}</span>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="start"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTaskClick(task)}
              disabled={isLoading || (task.id === 'sys_add_home' && !canAddToHomeScreen)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-[10px] font-black rounded-lg whitespace-nowrap transition-colors",
                isLoading || (task.id === 'sys_add_home' && !canAddToHomeScreen) 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              )}
            >
              {isLoading ? '...' : 'START'}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F7F9]">
      <Header title="Earn More" />
      
      <div className="p-4 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-white p-5 rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] -z-0 opacity-50"></div>
          <div className="relative z-10">
            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded mb-2">Boost Mining</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-1">Complete Tasks</h2>
            <p className="text-xs text-slate-500 font-medium">Increase your daily mining rate permanently by completing simple tasks.</p>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">System Bonuses</h3>
            </div>
            {activeSysTasks.map((t, i) => renderTask(t, i))}
          </motion.section>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Monetag Offers</h3>
            </div>
            {monetagTasks.map((t, i) => renderTask(t, i))}
          </motion.section>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AdsGram Offers</h3>
            </div>
            {adsgramTasks.map((t, i) => renderTask(t, i))}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
