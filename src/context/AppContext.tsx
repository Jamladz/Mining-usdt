import React, { createContext, useContext, useEffect, useState } from 'react';

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
  user: any | null; // Database user object
  setUser: React.Dispatch<React.SetStateAction<any>>;
  fetchUser: () => Promise<void>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  canFullscreen: boolean;
  homeScreenStatus: 'unsupported' | 'unknown' | 'added' | 'missed' | 'checking';
  canAddToHomeScreen: boolean;
  addToHomeScreen: () => void;
  safeAreaSupported: boolean;
  contentSafeAreaSupported: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tgData, setTgData] = useState<WebApp['initDataUnsafe'] | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [tgVersion, setTgVersion] = useState<string>('unknown');
  const [tgPlatform, setTgPlatform] = useState<string>('unknown');
  const [safeAreaSupported, setSafeAreaSupported] = useState<boolean>(false);
  const [contentSafeAreaSupported, setContentSafeAreaSupported] = useState<boolean>(false);
  const [user, setUser] = useState<any>(() => {
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
      } catch (e) {}
    }
  }, [user]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [homeScreenStatus, setHomeScreenStatus] = useState<'unsupported' | 'unknown' | 'added' | 'missed' | 'checking'>('checking');
  const [canAddToHomeScreen, setCanAddToHomeScreen] = useState(false);

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
      
      // Check safe areas
      if (webApp.safeAreaInset !== undefined) {
        setSafeAreaSupported(true);
      }
      if (webApp.contentSafeAreaInset !== undefined) {
        setContentSafeAreaSupported(true);
      }
      
      let cleanupFullscreen: (() => void) | undefined;
      let cleanupHomeScreen: (() => void) | undefined;

      // Check if requestFullscreen is supported (latest Telegram API, v8.0+)
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

          // Automatically request fullscreen on app start
          if (!webApp.isFullscreen) {
            webApp.requestFullscreen();
          }
        } catch (e) {
          console.warn('Fullscreen not supported on this version:', e);
          setCanFullscreen(false);
        }
      }
      
      // Check Home Screen Status support (Telegram v8.0+)
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
      // Mock for standard browser view
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

  const fetchUser = async () => {
    if (!initData) return;
    try {
      // Robustly extract start_param (Telegram Mini Apps pass it in initDataUnsafe or tgWebAppStartParam)
      let startParam = tgData?.start_param || '';
      
      if (!startParam) {
        try {
          const urlParams = new URLSearchParams(window.location.search || window.location.hash.replace('#', '?'));
          startParam = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || urlParams.get('start') || '';
        } catch(e) {}
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        },
        body: JSON.stringify({
          start_param: startParam
        })
      });
      const data = await res.json();
      if (data.user) {
        setUser({ 
          ...data.user, 
          referralsCount: data.referralsCount || 0,
          referralBonusEarned: data.referralBonusEarned || 0 
        });
      }
    } catch (e) {
      console.error('Failed to auth, falling back to local state:', e);
      // Only set default mock if no state exists at all
      setUser((current: any) => {
        if (current) return current;
        return {
          id: tgData?.user?.id?.toString() || '12345',
          firstName: tgData?.user?.first_name || 'Demo',
          username: tgData?.user?.username || 'demo_user',
          balance: 0,
          miningRate: 1000, // BASE_MINING_RATE
          totalEarned: 0,
          totalWithdrawn: 0,
          referralsCount: 0,
          referralBonusEarned: 0,
          photoUrl: tgData?.user?.photo_url || '',
          claimedMilestones: '[]',
          completedTasks: '[]'
        };
      });
    }
  };

  useEffect(() => {
    fetchUser();
  }, [initData]);

  return (
    <AppContext.Provider value={{ tgData, initData, tgVersion, tgPlatform, user, setUser, fetchUser, isFullscreen, toggleFullscreen, canFullscreen, homeScreenStatus, canAddToHomeScreen, addToHomeScreen, safeAreaSupported, contentSafeAreaSupported }}>
      {children}
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
