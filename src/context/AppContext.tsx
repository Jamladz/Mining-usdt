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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tgData, setTgData] = useState<WebApp['initDataUnsafe'] | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      setTgData(window.Telegram.WebApp.initDataUnsafe);
      setInitData(window.Telegram.WebApp.initData || 'mock_init_data');
    } else {
      // Mock for standard browser view
      setInitData('mock_init_data');
      setTgData({
        user: { id: 12345, first_name: 'Dev', username: 'dev_user' }
      });
    }
  }, []);

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
    <AppContext.Provider value={{ tgData, initData, user, fetchUser }}>
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
