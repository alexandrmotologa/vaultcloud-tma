import { useEffect, useMemo, useCallback } from 'react';

// Declarations for Telegram WebApp global
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date?: string;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}

export function useTelegram() {
  const tg = useMemo(() => {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  }, []);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, [tg]);

  const haptics = useMemo(() => ({
    impact: (style: 'light' | 'medium' | 'heavy' = 'light') => {
      tg?.HapticFeedback?.impactOccurred(style);
    },
    notification: (type: 'success' | 'error' | 'warning') => {
      tg?.HapticFeedback?.notificationOccurred(type);
    },
    selection: () => {
      tg?.HapticFeedback?.selectionChanged();
    },
  }), [tg]);

  const user = useMemo(() => {
    return tg?.initDataUnsafe?.user || {
      id: 10001,
      first_name: 'Demo',
      last_name: 'Explorer',
      username: 'demo_user',
    };
  }, [tg]);

  const initData = useMemo(() => {
    return tg?.initData || 'demo';
  }, [tg]);

  const close = useCallback(() => {
    tg?.close();
  }, [tg]);

  return {
    tg,
    user,
    initData,
    haptics,
    colorScheme: tg?.colorScheme || 'dark',
    themeParams: tg?.themeParams || {},
    close,
  };
}
