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

  const triggerBackendTaskCompletion = async (finalTaskId: string, provider: string, rewardRateBoost: number) => {
    const completionObj = { taskId: finalTaskId, completedAt: Date.now() };
    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ taskId: finalTaskId, provider })
      });
      
      const data = await res.json();
      if (data.success) {
        const updatedList = [...completedTasksList.filter(c => c.taskId !== finalTaskId), completionObj];
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
      const updatedList = [...completedTasksList.filter(c => c.taskId !== finalTaskId), completionObj];
      setCompletedTasksList(updatedList);
      
      if (user) {
        setUser({ 
          ...user, 
          balance: (user.balance || 0) + 100, // +0.01 USDT
          miningRate: (user.miningRate || 0) + rewardRateBoost,
          completedTasks: JSON.stringify(updatedList)
        });
      }
    }
  };

  // Listen to adsgram-task custom element rewards
  useEffect(() => {
    const el = document.getElementById('adsgram-task-component');
    if (el) {
      const handleReward = () => {
        console.log('Adsgram Task reward triggered!');
        triggerBackendTaskCompletion('adsgram_task', 'adsgram', 300);
      };
      const handleError = (e: any) => {
        console.warn('Adsgram Task element error:', e);
      };
      
      el.addEventListener('reward', handleReward);
      el.addEventListener('onError', handleError);
      return () => {
        el.removeEventListener('reward', handleReward);
        el.removeEventListener('onError', handleError);
      };
    }
  }, [completedTasksList]);

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

  const getTaskStatusInfo = (taskId: string) => {
    if (taskId === 'sys_add_home') {
      const status = getTaskStatus('sys_add_home');
      return {
        isCompleted: status.isCompleted,
        timeLeft: status.timeLeft,
        subLabel: 'Permanent Boost'
      };
    }
    
    if (taskId === 'adsgram_interstitial') {
      const completedSubtasks = [1, 2, 3, 4, 5].filter(num => getTaskStatus(`adsgram_interstitial_${num}`).isCompleted);
      const completedCount = completedSubtasks.length;
      
      if (completedCount === 5) {
        const lastStatus = getTaskStatus('adsgram_interstitial_5');
        return {
          isCompleted: true,
          timeLeft: lastStatus.timeLeft,
          subLabel: '5/5 Watched today'
        };
      } else {
        return {
          isCompleted: false,
          timeLeft: 0,
          subLabel: `${completedCount}/5 Watched today`
        };
      }
    }
    
    // Normal tasks
    const status = getTaskStatus(taskId);
    return {
      isCompleted: status.isCompleted,
      timeLeft: status.timeLeft,
      subLabel: 'Resets every 24 hours'
    };
  };

  const handleTaskClick = async (task: Task) => {
    const { isCompleted } = getTaskStatusInfo(task.id);
    if (loadingTask || isCompleted) return;
    
    // Ignore native Adsgram Task since it has its own HTML element handling
    if (task.id === 'adsgram_task') return;

    let finalTaskId = task.id;
    let blockId = '';
    let rewardRateBoost = 100;

    if (task.id === 'adsgram_reward') {
      blockId = '46657'; // Adsgram Reward Block ID (Pure number as string)
      rewardRateBoost = 200;
    } else if (task.id === 'adsgram_interstitial') {
      blockId = 'int-46658'; // Adsgram Interstitial Block ID (Requires 'int-' prefix)
      const completedSubtasks = [1, 2, 3, 4, 5].filter(num => getTaskStatus(`adsgram_interstitial_${num}`).isCompleted);
      const nextNum = completedSubtasks.length + 1;
      if (nextNum > 5) return;
      finalTaskId = `adsgram_interstitial_${nextNum}`;
      rewardRateBoost = 100;
    } else if (task.id === 'sys_add_home') {
      rewardRateBoost = 500;
    }

    if (task.action) {
      task.action();
    }

    setLoadingTask(task.id);

    // Adsgram official Ad controller invocation
    if (blockId) {
      const adsgramLib = (window as any).Adsgram;
      if (adsgramLib) {
        try {
          const AdController = adsgramLib.init({ blockId });
          await AdController.show();
          console.log('Adsgram Ad completed successfully');
        } catch (error: any) {
          console.warn('Adsgram Ad closed, skipped, or failed:', error);
          alert('You must watch the ad completely to claim your reward!');
          setLoadingTask(null);
          return;
        }
      } else {
        console.warn('Adsgram SDK not loaded or blocked, using fallback simulation');
      }
    }
    
    setTimeout(async () => {
      await triggerBackendTaskCompletion(finalTaskId, task.provider, rewardRateBoost);
      setLoadingTask(null);
    }, 1000);
  };

  const adsgramTasks: Task[] = [
    { 
      id: 'adsgram_reward', 
      title: 'Adsgram Reward Video', 
      provider: 'adsgram', 
      icon: <MonitorPlay className="w-5 h-5" />,
      rewardValue: '0.02'
    },
    { 
      id: 'adsgram_interstitial', 
      title: 'Adsgram Interstitial Ad', 
      provider: 'adsgram', 
      icon: <Play className="w-5 h-5" />,
      rewardValue: '0.01'
    },
    { 
      id: 'adsgram_task', 
      title: 'Adsgram Task Ad', 
      provider: 'adsgram', 
      icon: <Smartphone className="w-5 h-5" />,
      rewardValue: '0.03'
    }
  ];

  const sysTasks: Task[] = [
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
    const { isCompleted, timeLeft, subLabel } = getTaskStatusInfo(task.id);
    const isLoading = loadingTask === task.id;
    const reward = task.rewardValue || '0.01';
    
    if (task.id === 'adsgram_task' && !isCompleted) {
      return (
        <motion.div 
          key={task.id} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-3 rounded-2xl border mb-2 bg-white border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_4px_15px_rgb(0,0,0,0.04)]"
        >
          {React.createElement('adsgram-task', {
            id: 'adsgram-task-component',
            'data-block-id': 'task-46660',
            style: {
              display: 'block',
              width: '100%',
              fontFamily: 'inherit',
              '--adsgram-task-font-size': '13px',
              '--adsgram-task-icon-size': '40px',
              '--adsgram-task-icon-border-radius': '12px'
            }
          })}
        </motion.div>
      );
    }

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
            isCompleted ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-500"
          )}>
            {React.cloneElement(task.icon as React.ReactElement, { className: "w-4 h-4" })}
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <p className={cn("text-[13px] font-bold truncate tracking-tight", isCompleted ? "text-slate-400" : "text-slate-900")}>{task.title}</p>
            <p className={cn("text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5", isCompleted ? "text-slate-400" : "text-emerald-600")}>
              <span>+{reward} <USDT size="text-[9px]" iconSize="w-3 h-3" /> / 24H</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400 normal-case tracking-normal">{subLabel}</span>
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
    <div className="flex flex-col h-full overflow-hidden bg-[#F5F7F9]">
      <Header title="Earn More" />
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-12">
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
