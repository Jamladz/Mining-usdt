import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { USDT } from '../components/USDT';
import { useApp } from '../context/AppContext';
import { Play, CheckCircle2, MonitorPlay, MousePointerClick, Smartphone, Globe, Gift, BookmarkPlus, Send, Wallet, Zap } from 'lucide-react';
import { cn, formatUSDT } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Task {
  id: string;
  title: string;
  provider: 'monetag' | 'adsgram' | 'system';
  icon: React.ReactNode;
  rewardValue?: string;
  action?: () => void;
}

interface TasksTabProps {
  highlightedTaskId?: string | null;
  onClearHighlight?: () => void;
}

export function TasksTab({ highlightedTaskId, onClearHighlight }: TasksTabProps = {}) {
  const { user, setUser, fetchUser, initData, addToHomeScreen, homeScreenStatus, canAddToHomeScreen } = useApp();
  const [completedTasksList, setCompletedTasksList] = useState<{ taskId: string; completedAt: number }[]>([]);
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`task-${highlightedTaskId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 180);

    const clearTimer = setTimeout(() => {
      onClearHighlight?.();
    }, 6000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedTaskId]);
  
  // Manual Tasks State
  const [manualTaskStatuses, setManualTaskStatuses] = useState<Record<string, { status: string; createdAt?: number; externalUsername?: string }>>({});
  const [showManualInput, setShowManualInput] = useState<string | null>(null);
  const [externalUsername, setExternalUsername] = useState('');

  const fetchManualStatuses = async () => {
    try {
      const taskIds = ['sys_baat']; // Add more here if needed
      const results: any = {};
      for (const id of taskIds) {
        const res = await fetch(`/api/tasks/manual-status/${id}`, {
          headers: { 'Authorization': initData || '' }
        });
        if (res.ok) {
          results[id] = await res.json();
        }
      }
      setManualTaskStatuses(results);
    } catch (e) {
      console.warn('Failed to fetch manual task statuses', e);
    }
  };

  useEffect(() => {
    if (initData) {
      fetchManualStatuses();
    }
  }, [initData]);

  const submitManualTask = async (taskId: string) => {
    if (!externalUsername.trim()) return;
    setLoadingTask(taskId);
    try {
      const res = await fetch('/api/tasks/submit-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData || ''
        },
        body: JSON.stringify({ taskId, externalUsername })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Submission successful! Under review for 4 hours.', 'success');
        fetchManualStatuses();
        setShowManualInput(null);
        setExternalUsername('');
      } else {
        showToast(data.error || 'Failed to submit', 'error');
      }
    } catch (e) {
      showToast('Error submitting task', 'error');
    } finally {
      setLoadingTask(null);
    }
  };

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
    if (taskId === 'sys_add_home' || taskId === 'sys_join_hot_labs' || taskId === 'sys_join_teqoin' || taskId === 'sys_join_lamotrade' || taskId === 'sys_join_midaso' || taskId === 'sys_join_wallet' || taskId === 'sys_join_cryptorcs' || taskId === 'sys_join_pilotka' || taskId === 'sys_join_cryptomint' || taskId === 'sys_join_giftsvault' || taskId === 'sys_join_walt' || taskId === 'sys_join_riftycoin' || taskId === 'sys_join_ngm' || taskId === 'sys_join_grmfdex') {
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
    if (taskId === 'sys_baat') {
      const manualStatus = manualTaskStatuses[taskId];
      const isCompletedInHistory = completedTasksList.some(t => t.taskId === taskId);
      
      if (isCompletedInHistory || manualStatus?.status === 'approved') {
        return { isCompleted: true, timeLeft: 999999999, subLabel: 'Permanent Boost' };
      }

      if (manualStatus?.status === 'pending') {
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        const elapsed = currentTime - (manualStatus.createdAt || 0);
        const timeLeft = Math.max(0, FOUR_HOURS - elapsed);
        
        if (timeLeft > 0) {
          return { isCompleted: false, isInReview: true, timeLeft, subLabel: 'Under Review' };
        }
        // If 4 hours passed, backend returns 'expired' or we handle it here
      }

      if (manualStatus?.status === 'rejected' || manualStatus?.status === 'expired') {
        return { isCompleted: false, subLabel: 'Please retry' };
      }

      return { isCompleted: false, subLabel: 'Manual Verification' };
    }

    if (taskId === 'sys_add_home' || taskId === 'sys_join_hot_labs' || taskId === 'sys_join_teqoin' || taskId === 'sys_join_lamotrade' || taskId === 'sys_join_midaso' || taskId === 'sys_join_wallet' || taskId === 'sys_join_cryptorcs' || taskId === 'sys_join_pilotka' || taskId === 'sys_join_cryptomint' || taskId === 'sys_join_giftsvault' || taskId === 'sys_join_walt' || taskId === 'sys_join_riftycoin' || taskId === 'sys_join_ngm' || taskId === 'sys_join_grmfdex') {
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

    if (task.id === 'sys_join_wallet') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_wallet', 'system', 1000);
          showToast('🎉 Joined Telegram Wallet successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_walt') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_walt', 'system', 5000);
          showToast('🎉 Joined Walt successfully! Boosted rate by +0.50 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_riftycoin') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after 10 seconds so the user has time to complete the task
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_riftycoin', 'system', 5000);
          showToast('🎉 Joined RiftyCoin Bot successfully! Boosted rate by +0.50 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 10000);
      return;
    }

    if (task.id === 'sys_join_ngm') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after 10 seconds so the user has time to complete the task
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_ngm', 'system', 5000);
          showToast('🎉 Joined NGM Cloud Mining successfully! Boosted rate by +0.50 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 10000);
      return;
    }

    if (task.id === 'sys_join_grmfdex') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_grmfdex', 'system', 9000);
          showToast('🎉 Joined Grmfdex Bot successfully! Boosted rate by +0.90 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_giftsvault') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_giftsvault', 'system', 1000);
          showToast('🎉 Joined GiftsVault Bot successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_pilotka') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_pilotka', 'system', 10000);
          showToast('🎉 Joined Pilotka successfully! Boosted rate by +1.00 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_cryptorcs') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_cryptorcs', 'system', 1000);
          showToast('🎉 Joined CryptOrcs Bot successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_cryptomint') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_cryptomint', 'system', 1000);
          showToast('🎉 Joined CryptoMint NFT Bot successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_midaso') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_midaso', 'system', 1000);
          showToast('🎉 Joined Midaso Spin successfully! Boosted rate by +0.10 USDT/day.', 'success');
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingTask(null);
        }
      }, 3000);
      return;
    }

    if (task.id === 'sys_join_lamotrade') {
      setLoadingTask(task.id);
      task.action?.();
      
      // Complete after a short delay so the user has time to open the link
      setTimeout(async () => {
        try {
          await triggerBackendTaskCompletion('sys_join_lamotrade', 'system', 1000);
          showToast('🎉 Joined Lamo Trade successfully! Boosted rate by +0.10 USDT/day.', 'success');
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

    if (task.id === 'sys_baat') {
      task.action?.();
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
      id: 'sys_join_grmfdex', 
      title: 'Join Grmfdex Bot', 
      provider: 'system', 
      icon: <Play className="w-5 h-5" />,
      rewardValue: '0.9',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/Grmfdex_bot?startapp=ref_tg_1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_ngm', 
      title: 'Join NGM Cloud Mining', 
      provider: 'system', 
      icon: <Gift className="w-5 h-5" />,
      rewardValue: '0.5',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/NGMCloudeminingbot?start=ref_NHQ9KEHR';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_riftycoin', 
      title: 'Join RiftyCoin Bot', 
      provider: 'system', 
      icon: <Gift className="w-5 h-5" />,
      rewardValue: '0.5',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/riftycoinbot?startapp=ref_1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_baat', 
      title: 'Baat', 
      provider: 'system', 
      icon: <MonitorPlay className="w-5 h-5" />,
      rewardValue: '1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://os8.me/Nf5sGr';
        if (tg?.openLink) {
          tg.openLink(link);
        } else {
          window.open(link, '_blank');
        }
        // After opening link, show input for username
        setTimeout(() => setShowManualInput('sys_baat'), 1000);
      }
    },
    { 
      id: 'sys_join_giftsvault', 
      title: 'Join GiftsVault Bot', 
      provider: 'system', 
      icon: <Play className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/GiftsVault_bot?startapp=ref_1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_walt', 
      title: 'Join Walt', 
      provider: 'system', 
      icon: <Wallet className="w-5 h-5" />,
      rewardValue: '0.5',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://telegram.me/walt/start?startapp=ref-3-xaQt_2lcN8U';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_wallet', 
      title: 'Join Telegram Wallet', 
      provider: 'system', 
      icon: <Wallet className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://telegram.me/wallet/start?startapp=ref-3-xaQt_2lcN8U';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_pilotka', 
      title: 'Join Pilotka', 
      provider: 'system', 
      icon: <Gift className="w-5 h-5" />,
      rewardValue: '1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/pilotka?start=1368899842&startapp=roul';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_cryptorcs', 
      title: 'Join CryptOrcs Bot', 
      provider: 'system', 
      icon: <Play className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/CryptOrcs_bot?startapp=88998';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_cryptomint', 
      title: 'Join CryptoMint NFT Bot', 
      provider: 'system', 
      icon: <Send className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/cryptomintnftbot?start=REF-1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_midaso', 
      title: 'Join Midaso Spin', 
      provider: 'system', 
      icon: <Gift className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/AppMidaso_bot/SPIN?startapp=1368899842';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
    { 
      id: 'sys_join_lamotrade', 
      title: 'Join Lamo Trade', 
      provider: 'system', 
      icon: <Send className="w-5 h-5" />,
      rewardValue: '0.1',
      action: () => {
        const tg = (window as any).Telegram?.WebApp;
        const link = 'https://t.me/lamoTrade';
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(link);
        } else {
          window.open(link, '_blank');
        }
      }
    },
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

  const allTasksCount = activeSysTasks.length + monetagTasks.length;
  const completedCount = [...activeSysTasks, ...monetagTasks].filter(t => {
    const info = getTaskStatusInfo(t.id) as any;
    return info.isCompleted;
  }).length;

  const renderTask = (task: Task, index: number) => {
    const { isCompleted, timeLeft, subLabel, isInReview } = getTaskStatusInfo(task.id) as any;
    const isLoading = loadingTask === task.id;
    const reward = task.rewardValue || '0.01';
    const isManualInputActive = showManualInput === task.id;
    const isOneTime = ['sys_add_home', 'sys_join_hot_labs', 'sys_join_teqoin', 'sys_join_lamotrade', 'sys_join_midaso', 'sys_join_wallet', 'sys_join_cryptorcs', 'sys_join_pilotka', 'sys_join_cryptomint', 'sys_baat', 'sys_join_giftsvault', 'sys_join_walt', 'sys_join_riftycoin', 'sys_join_ngm', 'sys_join_grmfdex'].includes(task.id);
    const isHighlighted = highlightedTaskId === task.id && !isCompleted;

    return (
      <div id={`task-${task.id}`} key={task.id} className="flex flex-col">
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.25) }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-[22px] border transition-all",
            isCompleted 
              ? "bg-white/70 border-slate-100" 
              : isHighlighted
                ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/40 shadow-[0_10px_28px_-4px_rgba(16,185,129,0.22)]"
                : "bg-white border-slate-200/80 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.04)] hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3.5 overflow-hidden pr-2">
            <div className={cn("flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border transition-colors", 
              isCompleted 
                ? "bg-slate-50 border-slate-100 text-slate-400" 
                : task.provider === 'monetag'
                  ? "bg-indigo-50/80 border-indigo-100/80 text-indigo-600"
                  : "bg-emerald-50/80 border-emerald-100/80 text-emerald-600"
            )}>
              {React.cloneElement(task.icon as React.ReactElement, { className: "w-4 h-4" })}
            </div>
            <div className="flex flex-col min-w-0 justify-center">
              <p className={cn("text-[13px] font-extrabold truncate tracking-tight", isCompleted ? "text-slate-400" : "text-slate-900")}>
                {task.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold">
                <span className={cn("font-mono tabular-nums flex items-center", isCompleted ? "text-slate-400" : "text-emerald-600 font-black")}>
                  <USDT amount={'+' + reward} size="text-[10px]" iconSize="w-3 h-3" />
                  <span className="ml-0.5">/24H</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 truncate">{subLabel}</span>
              </div>
            </div>
          </div>
          
          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div 
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-end flex-shrink-0"
              >
                <div className="flex items-center gap-1 text-emerald-600 font-black text-[10px] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Done</span>
                </div>
                {!isOneTime && timeLeft > 0 && (
                  <span className="text-[9px] font-mono tabular-nums font-bold text-slate-400 mt-0.5">
                    {formatCountdown(timeLeft)}
                  </span>
                )}
              </motion.div>
            ) : isInReview ? (
              <motion.div 
                key="review"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-end flex-shrink-0"
              >
                <div className="flex items-center gap-1 text-amber-600 font-black text-[10px] uppercase tracking-wider">
                  <MonitorPlay className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Review</span>
                </div>
                {timeLeft > 0 && (
                  <span className="text-[9px] font-mono tabular-nums font-bold text-slate-400 mt-0.5">
                    {formatCountdown(timeLeft)}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="start"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTaskClick(task)}
                disabled={isLoading}
                className={cn(
                  "flex-shrink-0 h-9 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl whitespace-nowrap transition-all active:scale-95",
                  isLoading 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                    : task.id === 'sys_add_home' && homeScreenStatus === 'added'
                      ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600"
                      : "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                )}
              >
                {isLoading 
                  ? '...' 
                  : task.id === 'sys_add_home' 
                    ? (homeScreenStatus === 'added' ? 'Claim' : 'Start') 
                    : (manualTaskStatuses[task.id]?.status === 'rejected' || manualTaskStatuses[task.id]?.status === 'expired' ? 'Retry' : 'Start')}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {isManualInputActive && !isCompleted && !isInReview && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 bg-white border border-slate-200/90 rounded-[20px] p-3.5 shadow-sm flex flex-col gap-2.5"
          >
            <p className="text-[11px] font-bold text-slate-600">Enter your <span className="text-slate-900 font-extrabold">{task.title}</span> username to verify completion:</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={externalUsername}
                onChange={(e) => setExternalUsername(e.target.value)}
                placeholder="Username"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors"
              />
              <button 
                onClick={() => submitManualTask(task.id)}
                disabled={isLoading || !externalUsername.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
              >
                {isLoading ? '...' : 'Verify'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F4F6F9] overscroll-behavior-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
      <Header title="Earn More" />
      
      <div className="px-4 pt-3 pb-28 space-y-5 max-w-md mx-auto">
        {/* Executive Task Boost Hero Card */}
        <motion.div 
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35)] overflow-hidden border border-white/10"
        >
          <div className="absolute -top-20 -right-20 w-52 h-52 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Mining Speed Booster</span>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-400">
                {completedCount} / {allTasksCount} Done
              </span>
            </div>

            <h2 className="text-xl font-black tracking-tight text-white mb-1">Complete & Upgrade</h2>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-5">
              Every completed mission boosts your cloud mining speed for 24 hours or permanently.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-white/10">
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Speed</p>
                <div className="text-sm font-black text-emerald-400 font-mono tabular-nums flex items-center gap-1">
                  <USDT amount={`+${formatUSDT(user?.miningRate || 100)}`} size="text-sm" iconSize="w-4 h-4" />
                  <span className="text-[10px] text-slate-400 font-sans font-bold">/24h</span>
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Missions Done</p>
                <div className="text-sm font-black text-white font-mono tabular-nums">
                  {completedCount} <span className="text-[10px] text-slate-400 font-sans font-bold">Completed</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-emerald-500"></div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Partner & Ecosystem Tasks</h3>
              </div>
              <span className="text-[10px] font-mono tabular-nums font-bold text-slate-400">
                {activeSysTasks.length} Tasks
              </span>
            </div>
            <div className="space-y-2.5">
              {activeSysTasks.map((t, i) => renderTask(t, i))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-indigo-500"></div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Daily Ad Boosters</h3>
              </div>
              <span className="text-[10px] font-mono tabular-nums font-bold text-slate-400">
                24h Reset
              </span>
            </div>
            <div className="space-y-2.5">
              {monetagTasks.map((t, i) => renderTask(t, i))}
            </div>
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
              "fixed bottom-20 left-4 right-4 z-50 p-4 rounded-2xl shadow-lg border flex items-center gap-3 backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-600/95 text-white border-emerald-500" 
                : toast.type === 'error'
                  ? "bg-rose-600/95 text-white border-rose-500"
                  : "bg-slate-900/95 text-white border-slate-800"
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
