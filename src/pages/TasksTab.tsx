import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { USDT } from '../components/USDT';
import { useApp } from '../context/AppContext';
import { Play, CheckCircle2, MonitorPlay, MousePointerClick, Smartphone, Globe, Gift, BookmarkPlus, Send } from 'lucide-react';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Attempt Telegram native haptic feedback
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        if (type === 'success') {
          tg.HapticFeedback.notificationOccurred('success');
        } else if (type === 'error') {
          tg.HapticFeedback.notificationOccurred('error');
        } else {
          tg.HapticFeedback.impactOccurred('medium');
        }
      } catch (e) {
        console.warn('Telegram Haptic Feedback error:', e);
      }
    }
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Unexpected response format');
      }

      const data = await res.json();
      if (data.success) {
        // Auto-complete parent task if final subtask completed
        let parentToComplete = '';
        if (finalTaskId === 'monetag_rewarded_interstitial_15') parentToComplete = 'monetag_rewarded_interstitial';
        else if (finalTaskId === 'monetag_rewarded_popup_15') parentToComplete = 'monetag_rewarded_popup';

        let updatedList = [...completedTasksList.filter(c => c.taskId !== finalTaskId), completionObj];

        if (parentToComplete) {
          try {
            await fetch('/api/tasks/complete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': initData || ''
              },
              body: JSON.stringify({ taskId: parentToComplete, provider })
            });
            updatedList = [...updatedList.filter(c => c.taskId !== parentToComplete), { taskId: parentToComplete, completedAt: Date.now() }];
          } catch (err) {
            console.warn('Failed to auto-complete parent task:', err);
          }
        }

        setCompletedTasksList(updatedList);
        
        if (user) {
          setUser({
            ...user,
            miningRate: data.newRate || user.miningRate,
            completedTasks: JSON.stringify(updatedList)
          });
        }
        await fetchUser();
        showToast('Task completed successfully! Mining speed boosted.', 'success');
      } else {
        showToast(data.error || 'Failed to complete task', 'error');
      }
    } catch (e) {
      console.warn('Backend not available, using local simulation for task completion');
      
      let parentToComplete = '';
      if (finalTaskId === 'monetag_rewarded_interstitial_15') parentToComplete = 'monetag_rewarded_interstitial';
      else if (finalTaskId === 'monetag_rewarded_popup_15') parentToComplete = 'monetag_rewarded_popup';

      let updatedList = [...completedTasksList.filter(c => c.taskId !== finalTaskId), completionObj];
      if (parentToComplete) {
        updatedList = [...updatedList.filter(c => c.taskId !== parentToComplete), { taskId: parentToComplete, completedAt: Date.now() }];
      }

      setCompletedTasksList(updatedList);
      
      if (user) {
        setUser({ 
          ...user, 
          balance: (user.balance || 0) + 100, // +0.01 USDT
          miningRate: (user.miningRate || 0) + rewardRateBoost,
          completedTasks: JSON.stringify(updatedList)
        });
      }
      showToast('Task completed! Mining speed boosted (Demo Mode).', 'success');
    }
  };

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
    const record = completedTasksList.find(t => t.taskId === taskId);
    if (!record) return { isCompleted: false, timeLeft: 0 };
    
    // For one-time system tasks, it is completed once in history and never resets
    if (taskId === 'sys_add_home' || taskId === 'sys_join_ainovum' || taskId === 'sys_join_hot_labs' || taskId === 'sys_join_trx_bot' || taskId === 'sys_join_teqoin') {
      return { isCompleted: true, timeLeft: 999999999 };
    }
    
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

  const getMultiTaskInfo = (parentTaskId: string, maxCount: number) => {
    // 1. Check if the parent task itself is currently in a 24-hour cooldown
    const parentStatus = getTaskStatus(parentTaskId);
    
    if (parentStatus.isCompleted) {
      return {
        isCompleted: true,
        timeLeft: parentStatus.timeLeft,
        subLabel: `${maxCount}/${maxCount} Watched today`
      };
    }
    
    // 2. Find the last time the parent task was completed
    const parentRecord = completedTasksList.find(t => t.taskId === parentTaskId);
    const lastParentTime = parentRecord ? parentRecord.completedAt : 0;
    
    // 3. Count how many subtasks have been completed *after* the last parent task completion
    let completedInSession = 0;
    for (let i = 1; i <= maxCount; i++) {
      const subtaskId = `${parentTaskId}_${i}`;
      const subRecord = completedTasksList.find(t => t.taskId === subtaskId);
      if (subRecord && subRecord.completedAt > lastParentTime) {
        completedInSession++;
      }
    }
    
    return {
      isCompleted: false,
      timeLeft: 0,
      subLabel: `${completedInSession}/${maxCount} Watched today`
    };
  };

  const getTaskStatusInfo = (taskId: string) => {
    if (taskId === 'sys_add_home' || taskId === 'sys_join_ainovum' || taskId === 'sys_join_hot_labs' || taskId === 'sys_join_trx_bot' || taskId === 'sys_join_teqoin') {
      const status = getTaskStatus(taskId);
      return {
        isCompleted: status.isCompleted,
        timeLeft: status.timeLeft,
        subLabel: 'Permanent Boost'
      };
    }
    
    if (taskId === 'monetag_rewarded_interstitial') {
      return getMultiTaskInfo('monetag_rewarded_interstitial', 15);
    }

    if (taskId === 'monetag_rewarded_popup') {
      return getMultiTaskInfo('monetag_rewarded_popup', 15);
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
    
    // Custom check for Telegram Add to Home Screen task
    if (task.id === 'sys_add_home') {
      if (homeScreenStatus === 'added') {
        setLoadingTask(task.id);
        try {
          await triggerBackendTaskCompletion('sys_add_home', 'system', 300);
          showToast('🎉 Added to Home Screen successfully! Boosted rate by +0.03 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      } else {
        addToHomeScreen();
        showToast('Please add the app to your Home Screen, then click CLAIM to receive your +0.03 USDT/day boost!', 'info');
      }
      return;
    }

    if (task.id === 'sys_join_ainovum') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_ainovum', 'system', 100);
          showToast('🎉 Joined AI Novum Bot successfully! Boosted rate by +0.01 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_teqoin') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_teqoin', 'system', 1000);
          showToast('🎉 Joined TeQoin Wallet successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_trx_bot') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_trx_bot', 'system', 1000);
          showToast('🎉 Joined TRX Power Mining Bot successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_hot_labs') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_hot_labs', 'system', 100);
          showToast('🎉 Joined Hot Labs successfully! Boosted rate by +0.01 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    // Trigger Telegram click haptic feedback
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (e) {}
    }

    if (task.provider === 'monetag') {
      const showAd = (window as any).show_11747006;
      if (!showAd) {
        showToast('Monetag SDK is loaded but currently unavailable. Please check your connection or disable ad blockers.', 'error');
        return;
      }

      setLoadingTask(task.id);

      if (task.id === 'monetag_rewarded_interstitial') {
        const parentRecord = completedTasksList.find(t => t.taskId === 'monetag_rewarded_interstitial');
        const lastParentTime = parentRecord ? parentRecord.completedAt : 0;
        const completedSubtasks = Array.from({ length: 15 }, (_, i) => i + 1).filter(num => {
          const r = completedTasksList.find(t => t.taskId === `monetag_rewarded_interstitial_${num}`);
          return r && r.completedAt > lastParentTime;
        });
        const nextNum = completedSubtasks.length + 1;
        if (nextNum > 15) {
          setLoadingTask(null);
          return;
        }

        try {
          await showAd();
          await triggerBackendTaskCompletion(`monetag_rewarded_interstitial_${nextNum}`, 'monetag', 30);
        } catch (error) {
          console.warn('Monetag Rewarded Interstitial error/dismissed:', error);
          showToast('You must watch the advertisement completely to claim your reward!', 'error');
        } finally {
          setLoadingTask(null);
        }
      } else if (task.id === 'monetag_rewarded_popup') {
        const parentRecord = completedTasksList.find(t => t.taskId === 'monetag_rewarded_popup');
        const lastParentTime = parentRecord ? parentRecord.completedAt : 0;
        const completedSubtasks = Array.from({ length: 15 }, (_, i) => i + 1).filter(num => {
          const r = completedTasksList.find(t => t.taskId === `monetag_rewarded_popup_${num}`);
          return r && r.completedAt > lastParentTime;
        });
        const nextNum = completedSubtasks.length + 1;
        if (nextNum > 15) {
          setLoadingTask(null);
          return;
        }

        try {
          await showAd('pop');
          await triggerBackendTaskCompletion(`monetag_rewarded_popup_${nextNum}`, 'monetag', 20);
        } catch (error) {
          console.warn('Monetag Rewarded Popup error/dismissed:', error);
          showToast('You must interact with the advertisement completely to claim your reward!', 'error');
        } finally {
          setLoadingTask(null);
        }
      }
      return;
    }

    let finalTaskId = task.id;
    let rewardRateBoost = 10;

    if (task.id === 'sys_add_home') {
      rewardRateBoost = 50;
    }

    if (task.action) {
      task.action();
    }

    setLoadingTask(task.id);
    
    setTimeout(async () => {
      await triggerBackendTaskCompletion(finalTaskId, task.provider, rewardRateBoost);
      setLoadingTask(null);
    }, 1000);
  };

  const monetagTasks: Task[] = [
    {
      id: 'monetag_rewarded_interstitial',
      title: 'Watch an Ad',
      provider: 'monetag',
      icon: <MonitorPlay className="w-5 h-5" />,
      rewardValue: '0.003'
    },
    {
      id: 'monetag_rewarded_popup',
      title: 'Watch Rewarded Popup',
      provider: 'monetag',
      icon: <MousePointerClick className="w-5 h-5" />,
      rewardValue: '0.002'
    }
  ];

  const sysTasks: Task[] = [
    { 
      id: 'sys_join_teqoin', 
      title: 'Join TeQoin Wallet', 
      provider: 'system', 
      icon: <Globe className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/TeQoin_Wallet_Bot/app?startapp=r_1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_ainovum', 
      title: 'Join AI Novum Bot', 
      provider: 'system', 
      icon: <Send className="w-5 h-5" />,
      rewardValue: '0.01',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/ainovum_bot?start=ref_1368899842&startapp=ref_1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_trx_bot', 
      title: 'TRX Power Mining Bot', 
      provider: 'system', 
      icon: <Smartphone className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/trxpowermining_bot?start=ref_TRX1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_hot_labs', 
      title: 'Join Hot Labs', 
      provider: 'system', 
      icon: <Gift className="w-5 h-5" />,
      rewardValue: '0.01',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://app.hot-labs.org/link?699428uu';
        if (tg?.openLink) {
          tg.openLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_add_home', 
      title: 'Add to Home Screen', 
      provider: 'system', 
      icon: <BookmarkPlus className="w-5 h-5" />,
      rewardValue: '0.03',
      action: addToHomeScreen
    }
  ];

  const activeSysTasks = sysTasks;

  const renderTask = (task: Task, index: number) => {
    const { isCompleted, timeLeft, subLabel } = getTaskStatusInfo(task.id);
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
            isCompleted 
              ? "bg-slate-100 text-slate-400" 
              : task.provider === 'monetag'
                ? "bg-indigo-50 text-indigo-500"
                : "bg-blue-50 text-blue-500"
          )}>
            {React.cloneElement(task.icon as React.ReactElement, { className: "w-4 h-4" })}
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <p className={cn("text-[13px] font-bold truncate tracking-tight", isCompleted ? "text-slate-400" : "text-slate-900")}>{task.title}</p>
            <p className={cn("text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5", isCompleted ? "text-slate-400" : "text-emerald-600")}>
              <span><USDT amount={'+' + reward} size="text-[9px]" iconSize="w-3 h-3" /> / 24H</span>
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
              className="flex flex-col items-end"
            >
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-full font-black text-[9px] border border-emerald-100/60 shadow-[0_1px_5px_rgba(16,185,129,0.05)]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>COMPLETED</span>
              </div>
              {!['sys_add_home', 'sys_join_ainovum', 'sys_join_hot_labs', 'sys_join_trx_bot', 'sys_join_teqoin'].includes(task.id) && timeLeft > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-0.5 rounded-full text-[8px] font-mono font-extrabold text-slate-500 border border-slate-200/50 mt-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
                  </span>
                  <span>RESETS IN {formatCountdown(timeLeft)}</span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="start"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTaskClick(task)}
              disabled={isLoading}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-[10px] font-black rounded-lg whitespace-nowrap transition-colors",
                isLoading 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : task.id === 'sys_add_home' && homeScreenStatus === 'added'
                    ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)] hover:bg-emerald-600 animate-pulse font-black"
                    : "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
              )}
            >
              {isLoading 
                ? '...' 
                : task.id === 'sys_add_home' 
                  ? (homeScreenStatus === 'added' ? 'CLAIM' : 'START') 
                  : 'START'}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F5F7F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Earn More" />
      
      <div className="p-4 pb-24">
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



          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Monetag Offers</h3>
            </div>
            {monetagTasks.map((t, i) => renderTask(t, i))}
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-20 left-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-600/95 text-white border-emerald-500" 
                : toast.type === 'error'
                  ? "bg-rose-600/95 text-white border-rose-500"
                  : "bg-slate-900/95 text-white border-slate-850"
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-white animate-bounce" />}
            {toast.type === 'error' && <span className="text-base flex-shrink-0">⚠️</span>}
            <p className="text-[11px] font-extrabold tracking-tight flex-1">{toast.message}</p>
            <button onClick={() => setToast(null)} className="text-white/60 hover:text-white text-[10px] font-black px-1.5 py-0.5 rounded">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
