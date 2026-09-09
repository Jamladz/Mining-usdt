import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { syncUserToFirebase } from '../lib/firebase';
import { User } from '../types';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface WebApp {
  initData: string;
  version: string;
  platform: string;
  isVersionAtLeast: (version: string) => boolean;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
    start_param?: string;
  };
  expand: () => void;
  isExpanded: boolean;
  ready: () => void;
  openTelegramLink: (url: string) => void;
  requestFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;
  onEvent: (eventType: string, eventHandler: Function) => void;
  offEvent: (eventType: string, eventHandler: Function) => void;
  lockOrientation: () => void;
  unlockOrientation: () => void;
  checkHomeScreenStatus: () => void;
  addToHomeScreen: () => void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  MainButton: any;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: Function) => void;
    offClick: (callback: Function) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage?: {
    setItem: (key: string, value: string, callback?: (err: any, success: boolean) => void) => void;
    getItem: (key: string, callback: (err: any, value: string) => void) => void;
    removeItem: (key: string, callback?: (err: any, success: boolean) => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: WebApp;
    };
  }
}

interface AppContextType {
  tgData: WebApp['initDataUnsafe'] | null;
  initData: string | null;
  tgVersion: string;
  tgPlatform: string;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  fetchUser: () => Promise<void>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  canFullscreen: boolean;
  homeScreenStatus: 'unsupported' | 'unknown' | 'added' | 'missed' | 'checking';
  canAddToHomeScreen: boolean;
  addToHomeScreen: () => void;
  safeAreaSupported: boolean;
  contentSafeAreaSupported: boolean;
  showToast: (message: React.ReactNode, type?: 'success' | 'error' | 'info') => void;
  isAuthCompleted: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tgData, setTgData] = useState<WebApp['initDataUnsafe'] | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [tgVersion, setTgVersion] = useState<string>('unknown');
  const [tgPlatform, setTgPlatform] = useState<string>('unknown');
  const [safeAreaSupported, setSafeAreaSupported] = useState<boolean>(false);
  const [contentSafeAreaSupported, setContentSafeAreaSupported] = useState<boolean>(false);
  const [isAuthCompleted, setIsAuthCompleted] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('usdt_miner_user_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('usdt_miner_user_data', JSON.stringify(user));
        syncUserToFirebase(user);
      } catch (e) {}
    }
  }, [user]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [homeScreenStatus, setHomeScreenStatus] = useState<'unsupported' | 'unknown' | 'added' | 'missed' | 'checking'>('checking');
  const [canAddToHomeScreen, setCanAddToHomeScreen] = useState(false);
  const [toast, setToast] = useState<{ message: React.ReactNode; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: React.ReactNode, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (window.Telegram?.WebApp?.HapticFeedback) {
      try {
        const haptic = window.Telegram.WebApp.HapticFeedback;
        if (type === 'success') {
          haptic.notificationOccurred('success');
        } else if (type === 'error') {
          haptic.notificationOccurred('error');
        } else {
          haptic.impactOccurred('light');
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp as any;
      webApp.ready();
      webApp.expand();
      if (typeof webApp.disableVerticalSwipes === 'function') {
        webApp.disableVerticalSwipes();
      }
      setTgData(webApp.initDataUnsafe);
      setInitData(webApp.initData || 'mock_init_data');
      setTgVersion(webApp.version || 'unknown');
      setTgPlatform(webApp.platform || 'unknown');
      
      if (webApp.safeAreaInset !== undefined) {
        setSafeAreaSupported(true);
      }
      if (webApp.contentSafeAreaInset !== undefined) {
        setContentSafeAreaSupported(true);
      }
      
      let cleanupFullscreen: (() => void) | undefined;
      let cleanupHomeScreen: (() => void) | undefined;

      if (typeof webApp.requestFullscreen === 'function' && webApp.isVersionAtLeast && webApp.isVersionAtLeast('8.0')) {
        try {
          setCanFullscreen(true);
          setIsFullscreen(webApp.isFullscreen || false);
          const handleFullscreenChange = () => {
            setIsFullscreen(webApp.isFullscreen);
          };
          
          const handleFullscreenFailed = (error: any) => {
            console.warn('Fullscreen failed:', error);
          };
  
          webApp.onEvent('fullscreenChanged', handleFullscreenChange);
          webApp.onEvent('fullscreenFailed', handleFullscreenFailed);
  
          cleanupFullscreen = () => {
            webApp.offEvent('fullscreenChanged', handleFullscreenChange);
            webApp.offEvent('fullscreenFailed', handleFullscreenFailed);
          };

          if (!webApp.isFullscreen) {
            webApp.requestFullscreen();
          }
        } catch (e) {
          console.warn('Fullscreen not supported on this version:', e);
          setCanFullscreen(false);
        }
      }
      
      if (typeof webApp.checkHomeScreenStatus === 'function' && webApp.isVersionAtLeast && webApp.isVersionAtLeast('8.0')) {
        try {
          const handleHomeScreenChecked = (event: { status: string }) => {
            setHomeScreenStatus(event.status as any);
            if (event.status === 'missed') {
              setCanAddToHomeScreen(true);
            } else {
              setCanAddToHomeScreen(false);
            }
          };
  
          const handleHomeScreenAdded = () => {
            setHomeScreenStatus('added');
            setCanAddToHomeScreen(false);
          };
  
          webApp.onEvent('homeScreenChecked', handleHomeScreenChecked);
          webApp.onEvent('homeScreenAdded', handleHomeScreenAdded);
  
          webApp.checkHomeScreenStatus();
          
          cleanupHomeScreen = () => {
            webApp.offEvent('homeScreenChecked', handleHomeScreenChecked);
            webApp.offEvent('homeScreenAdded', handleHomeScreenAdded);
          };
        } catch (e) {
          console.warn('Home screen status not supported on this version:', e);
          setHomeScreenStatus('unsupported');
        }
      } else {
        setHomeScreenStatus('unsupported');
      }

      return () => {
        if (cleanupFullscreen) cleanupFullscreen();
        if (cleanupHomeScreen) cleanupHomeScreen();
      };
    } else {
      setInitData('mock_init_data');
      setTgData({
        user: { id: 12345, first_name: 'Dev', username: 'dev_user' }
      });
      setHomeScreenStatus('unsupported');
    }
  }, []);

  const toggleFullscreen = () => {
    if (window.Telegram?.WebApp && typeof window.Telegram.WebApp.requestFullscreen === 'function' && window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('8.0')) {
      try {
        const webApp = window.Telegram.WebApp;
        if (webApp.isFullscreen) {
          webApp.exitFullscreen();
        } else {
          webApp.requestFullscreen();
        }
      } catch (e) {
        console.warn('Fullscreen toggle failed:', e);
      }
    }
  };

  const addToHomeScreen = () => {
    if (window.Telegram?.WebApp && typeof window.Telegram.WebApp.addToHomeScreen === 'function' && window.Telegram.WebApp.isVersionAtLeast && window.Telegram.WebApp.isVersionAtLeast('8.0')) {
      try {
        window.Telegram.WebApp.addToHomeScreen();
      } catch (e) {
        console.warn('addToHomeScreen failed:', e);
      }
    }
  };

  const getStoredReferrer = (): Promise<string> => {
    return new Promise((resolve) => {
      const cloudStorage = window.Telegram?.WebApp?.CloudStorage;
      if (!cloudStorage) return resolve('');
      try {
        cloudStorage.getItem('pending_referrer', (err, val) => {
          if (err || !val) {
            resolve('');
          } else {
            resolve(val);
          }
        });
      } catch (e) {
        resolve('');
      }
    });
  };

  const fetchUser = async () => {
    if (!initData) return;
    try {
      let startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';
      
      if (!startParam) {
        try {
          const urlParams = new URLSearchParams(window.location.search || window.location.hash.replace('#', '?'));
          startParam = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('start') || '';
        } catch(e) {}
      }

      const cloudStorage = window.Telegram?.WebApp?.CloudStorage;
      if (startParam) {
        if (cloudStorage) {
          try {
            cloudStorage.setItem('pending_referrer', startParam, () => {});
          } catch (e) {}
        }
      } else {
        const backedUp = await getStoredReferrer();
        if (backedUp) {
          startParam = backedUp;
        }
      }

      // In production with Cloudflare, this should point to your Worker URL
      // E.g., 'https://usdt-miner-backend.<your-username>.workers.dev/api/auth'
      // We use a relative path for the dev environment and an env variable for production
      const apiUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/auth` : '/api/auth';
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        }
      });
      const data = await res.json();
      if (data.user) {
        const newUser: User = { 
          ...data.user, 
          referralsCount: data.referralsCount ?? data.user.referralsCount ?? 0,
          referralEarnings: data.referralEarnings ?? data.user.referralEarnings ?? 0
        };

        setIsAuthCompleted(true);

        if (newUser.referredBy && cloudStorage) {
          try {
            cloudStorage.removeItem('pending_referrer', () => {});
          } catch (e) {}
        }

        // Referral count increase notification
        setUser((prevUser: User | null) => {
          if (prevUser && newUser.referralsCount > prevUser.referralsCount) {
            setTimeout(() => {
              showToast(
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-black text-amber-200">🎉 New Friend Joined!</span>
                  <span className="text-[11px] font-bold text-white opacity-90">+0.10 USDT reward and a permanent +0.01 mining boost added.</span>
                </div>, 
                'success'
              );
            }, 800);
          }
          return newUser;
        });
      }
    } catch (e) {
      console.error('Failed to auth, falling back to local state:', e);
      setUser((current: any) => {
        if (current) return current;
        return {
          id: tgData?.user?.id?.toString() || '12345',
          firstName: tgData?.user?.first_name || 'Demo',
          username: tgData?.user?.username || 'demo_user',
          balance: 0,
          miningRate: 1000,
          totalEarned: 0,
          totalWithdrawn: 0,
          referralsCount: 0,
          referralEarnings: 0,
          photoUrl: tgData?.user?.photo_url || '',
          completedTasks: '[]'
        };
      });
    }
  };

  useEffect(() => {
    fetchUser();
  }, [initData]);

  return (
    <AppContext.Provider value={{ tgData, initData, tgVersion, tgPlatform, user, setUser, fetchUser, isFullscreen, toggleFullscreen, canFullscreen, homeScreenStatus, canAddToHomeScreen, addToHomeScreen, safeAreaSupported, contentSafeAreaSupported, showToast, isAuthCompleted }}>
      {children}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-24 left-4 right-4 z-50 p-4 rounded-xl shadow-xl border flex items-center gap-3 backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-emerald-600/95 text-white border-emerald-500" 
                : toast.type === 'error'
                  ? "bg-rose-600/95 text-white border-rose-500"
                  : "bg-slate-900/95 text-white border-slate-800"
            )}
          >
            {toast.type === 'success' ? (
              <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-300 animate-pulse" />
            ) : toast.type === 'error' ? (
              <span className="text-base flex-shrink-0">⚠️</span>
            ) : (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-white" />
            )}
            <p className="text-xs font-bold tracking-tight flex-1 text-white">{toast.message}</p>
            <button onClick={() => setToast(null)} className="text-white/60 hover:text-white text-xs font-black px-1.5 py-0.5 rounded">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
