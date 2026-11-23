import { useEffect, useState } from 'react';
import {
  isIosUserAgent,
  isStandaloneDisplayMode,
  resolveInstallFlowMode,
} from '../utils/pwaLogic';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const updateStandalone = () => {
      const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
      setIsInstalled(
        isStandaloneDisplayMode({
          matchMediaStandalone: mediaQuery.matches,
          navigatorStandalone: navStandalone,
        })
      );
    };

    updateStandalone();
    mediaQuery.addEventListener('change', updateStandalone);

    setIsIOS(isIosUserAgent(window.navigator.userAgent, window.navigator.maxTouchPoints));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', updateStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  const flowMode = resolveInstallFlowMode({
    isInstalled,
    hasDeferredPrompt: !!deferredPrompt,
    isIOS,
  });

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    flowMode,
    install,
  };
}
