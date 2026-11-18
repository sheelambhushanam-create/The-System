import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface InstallPromptDecision {
  visible: boolean;
  mode: 'none' | 'native' | 'ios';
}

export function isIOSUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function isStandaloneDisplay(options: {
  matchMediaStandalone?: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return Boolean(options.matchMediaStandalone || options.navigatorStandalone);
}

export function resolveInstallPromptMode(options: {
  isInstalled: boolean;
  hasDeferredPrompt: boolean;
  isIOS: boolean;
}): InstallPromptDecision {
  if (options.isInstalled) {
    return { visible: false, mode: 'none' };
  }
  if (options.hasDeferredPrompt) {
    return { visible: true, mode: 'native' };
  }
  if (options.isIOS) {
    return { visible: true, mode: 'ios' };
  }
  return { visible: false, mode: 'none' };
}

let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

function setCachedDeferredPrompt(ev: BeforeInstallPromptEvent | null) {
  cachedDeferredPrompt = ev;
  promptSubscribers.forEach((cb) => cb(ev));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    setCachedDeferredPrompt(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    setCachedDeferredPrompt(null);
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const matchMediaStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const navigatorStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return isStandaloneDisplay({ matchMediaStandalone, navigatorStandalone });
  });
  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isIOSUserAgent(window.navigator.userAgent || '');
  });

  useEffect(() => {
    const matchMediaStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const navigatorStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandaloneDisplay({ matchMediaStandalone, navigatorStandalone }));
    setIsIOS(isIOSUserAgent(window.navigator.userAgent || ''));

    const subscriber = (ev: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(ev);
    };
    promptSubscribers.add(subscriber);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setCachedDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCachedDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptSubscribers.delete(subscriber);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const activePrompt = deferredPrompt || cachedDeferredPrompt;
    if (!activePrompt) return false;
    await activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCachedDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const decision = resolveInstallPromptMode({
    isInstalled,
    hasDeferredPrompt: Boolean(deferredPrompt),
    isIOS,
  });

  return {
    isInstallable: decision.mode === 'native',
    isInstalled,
    isIOS: decision.mode === 'ios',
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
