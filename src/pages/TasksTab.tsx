import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { USDT } from '../components/USDT';
import { useApp } from '../context/AppContext';
import { Play, CheckCircle2, MonitorPlay, MousePointerClick, Smartphone, Globe, Gift } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Task {
  id: string;
  title: string;
  provider: 'monetag' | 'adsgram' | 'system';
  icon: React.ReactNode;
}

export function TasksTab() {
  const { user, setUser, fetchUser, initData } = useApp();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [loadingTask, setLoadingTask] = useState<string | null>(null);

  useEffect(() => {
    if (user?.completedTasks) {
      setCompletedTasks(JSON.parse(user.completedTasks));
    }
  }, [user]);

  const handleTaskClick = async (task: Task) => {
    if (loadingTask || completedTasks.includes(task.id)) return;
    setLoadingTask(task.id);
    
    setTimeout(async () => {
      try {
        const res = await fetch('/api/task/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': initData || ''
          },
          body: JSON.stringify({ taskId: task.id })
        });
        
        const data = await res.json();
        if (data.success) {
          setCompletedTasks(prev => [...prev, task.id]);
          await fetchUser();
        } else {
          alert(data.error || 'Failed to complete task');
        }
      } catch (e) {
        console.warn('Backend not available, using local simulation for task completion');
        setCompletedTasks(prev => {
          const newTasks = [...prev, task.id];
          if (user) {
            setUser({ 
              ...user, 
              balance: (user.balance || 0) + 1, // Simulate 1 USDT reward
              completedTasks: JSON.stringify(newTasks)
            });
          }
          return newTasks;
        });
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
    { id: 'sys_daily', title: 'Daily Check-in', provider: 'system', icon: <Gift className="w-5 h-5" /> }
  ];

  const renderTask = (task: Task, index: number) => {
    const isCompleted = completedTasks.includes(task.id);
    const isLoading = loadingTask === task.id;
    
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
            <p className={cn("text-[9px] font-bold uppercase tracking-widest flex items-center gap-1", isCompleted ? "text-slate-400" : "text-emerald-600")}>+0.01 <USDT size="text-[9px]" iconSize="w-3 h-3" /> / 24H</p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {isCompleted ? (
            <motion.div 
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-shrink-0 flex items-center gap-1 text-slate-400 font-bold text-[10px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>DONE</span>
            </motion.div>
          ) : (
            <motion.button
              key="start"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTaskClick(task)}
              disabled={isLoading}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-[10px] font-black rounded-lg whitespace-nowrap transition-colors",
                isLoading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
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
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Monetag Offers</h3>
            </div>
            {monetagTasks.map((t, i) => renderTask(t, i))}
          </motion.section>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AdsGram Offers</h3>
            </div>
            {adsgramTasks.map((t, i) => renderTask(t, i))}
          </motion.section>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">System Bonuses</h3>
            </div>
            {sysTasks.map((t, i) => renderTask(t, i))}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
