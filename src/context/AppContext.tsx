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
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
    start_param?: string;
  };
  expand: () => void;
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
  MainButton: any;
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
  user: any | null; // Database user object
  fetchUser: () => Promise<void>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  canFullscreen: boolean;
  homeScreenStatus: 'unsupported' | 'unknown' | 'added' | 'missed' | 'checking';
  canAddToHomeScreen: boolean;
  addToHomeScreen: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tgData, setTgData] = useState<WebApp['initDataUnsafe'] | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [homeScreenStatus, setHomeScreenStatus] = useState<'unsupported' | 'unknown' | 'added' | 'missed' | 'checking'>('checking');
  const [canAddToHomeScreen, setCanAddToHomeScreen] = useState(false);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();
      setTgData(webApp.initDataUnsafe);
      setInitData(webApp.initData || 'mock_init_data');
      
      // Check if requestFullscreen is supported (latest Telegram API)
      if (typeof webApp.requestFullscreen === 'function') {
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

        return () => {
          webApp.offEvent('fullscreenChanged', handleFullscreenChange);
          webApp.offEvent('fullscreenFailed', handleFullscreenFailed);
        };
      }
      
      // Check Home Screen Status support
      if (typeof webApp.checkHomeScreenStatus === 'function') {
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
        
        // Return cleanup fn
        return () => {
          webApp.offEvent('homeScreenChecked', handleHomeScreenChecked);
          webApp.offEvent('homeScreenAdded', handleHomeScreenAdded);
        };
      } else {
        setHomeScreenStatus('unsupported');
      }
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
    if (window.Telegram?.WebApp && typeof window.Telegram.WebApp.requestFullscreen === 'function') {
      const webApp = window.Telegram.WebApp;
      if (webApp.isFullscreen) {
        webApp.exitFullscreen();
      } else {
        webApp.requestFullscreen();
      }
    }
  };

  const addToHomeScreen = () => {
    if (window.Telegram?.WebApp && typeof window.Telegram.WebApp.addToHomeScreen === 'function') {
      window.Telegram.WebApp.addToHomeScreen();
    }
  };

  const fetchUser = async () => {
    if (!initData) return;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': initData
        },
        body: JSON.stringify({
          start_param: tgData?.start_param || ''
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
      console.error('Failed to auth', e);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [initData]);

  return (
    <AppContext.Provider value={{ tgData, initData, user, fetchUser, isFullscreen, toggleFullscreen, canFullscreen, homeScreenStatus, canAddToHomeScreen, addToHomeScreen }}>
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
