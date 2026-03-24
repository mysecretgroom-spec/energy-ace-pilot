import { useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// Minimum connection quality for auto-update (in Mbps estimated)
const MIN_EFFECTIVE_TYPE_FOR_UPDATE = ['4g', '3g'];

// Version key to detect stale SWs from old deployments
const SW_VERSION_KEY = 'pwa-sw-version';
declare const __APP_VERSION__: string;
const CURRENT_SW_VERSION = __APP_VERSION__;

function hasGoodConnection(): boolean {
  if (!navigator.onLine) return false;

  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;

  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType && !MIN_EFFECTIVE_TYPE_FOR_UPDATE.includes(effectiveType)) {
      return false;
    }
    if (connection.saveData) return false;
    if (connection.downlink !== undefined && connection.downlink < 0.5) return false;
  }

  return true;
}

/**
 * Unregister all service workers except the current one.
 * Clears old caches to prevent stale SWs from blocking updates.
 */
async function cleanupStaleSWs(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  const storedVersion = localStorage.getItem(SW_VERSION_KEY);
  
  // If version changed, clear all SW caches to force clean install
  if (storedVersion && storedVersion !== CURRENT_SW_VERSION) {
    console.log('[PWA] Version mismatch detected, cleaning up stale caches...', {
      stored: storedVersion,
      current: CURRENT_SW_VERSION,
    });

    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[PWA] Cleared', cacheNames.length, 'stale caches');
    
    localStorage.setItem(SW_VERSION_KEY, CURRENT_SW_VERSION);
    return true;
  }

  localStorage.setItem(SW_VERSION_KEY, CURRENT_SW_VERSION);
  return false;
}

export function usePWAUpdate() {
  const toastShownRef = useRef(false);
  const userTriggeredRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);
      
      // On first registration, check for a waiting SW (user already refreshed)
      if (registration?.waiting) {
        console.log('[PWA] Found waiting SW on registration, prompting update...');
        setNeedRefresh(true);
      }

      // Check for updates periodically (every 1 hour)
      if (registration) {
        setInterval(() => {
          if (hasGoodConnection()) {
            console.log('[PWA] Checking for updates...');
            registration.update();
          }
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error);
    },
  });

  // Cleanup stale SWs on mount
  useEffect(() => {
    cleanupStaleSWs().then((cleaned) => {
      if (cleaned) {
        console.log('[PWA] Stale caches cleaned, forcing SW update...');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.update();
          });
        }
      }
    });
  }, []);

  // Check for updates when app becomes visible or reopened
  const checkForUpdates = useCallback(() => {
    if (!hasGoodConnection()) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('[PWA] Checking for updates...');
          registration.update();
          
          // If there's already a waiting SW, prompt immediately
          if (registration.waiting) {
            console.log('[PWA] Found waiting SW, prompting update...');
            setNeedRefresh(true);
          }
        }
      });
    }
  }, [setNeedRefresh]);

  // Handle visibility change + app reopen (pageshow for bfcache on iOS)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[PWA] App restored from bfcache, checking updates...');
        checkForUpdates();
      }
    };

    const timer = setTimeout(checkForUpdates, 2000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkForUpdates);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', checkForUpdates);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkForUpdates);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', checkForUpdates);
    };
  }, [checkForUpdates]);

  // Apply update: send SKIP_WAITING and reload
  const applyUpdate = useCallback(() => {
    userTriggeredRef.current = true;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          console.log('[PWA] User accepted update, sending SKIP_WAITING...');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  // Show a persistent toast when update is available (only once per session)
  useEffect(() => {
    if (needRefresh && !toastShownRef.current) {
      toastShownRef.current = true;
      console.log('[PWA] Update available, showing notification...');

      toast('Nouvelle version disponible 🚀', {
        description: 'Actualisez pour profiter des dernières améliorations.',
        duration: Infinity,
        action: {
          label: 'Actualiser',
          onClick: applyUpdate,
        },
        // Don't reset toastShownRef on dismiss — prevents repeated prompts
      });
    }
  }, [needRefresh, applyUpdate]);

  // Listen for the new SW taking control → reload only if user triggered it
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !userTriggeredRef.current) return;
        reloading = true;
        console.log('[PWA] New SW activated via user action, reloading...');
        window.location.reload();
      });
    }
  }, []);

  const forceCheckAndUpdate = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        console.log('[PWA] Force checking for updates...');
        await registration.update();
        if (registration.waiting) {
          userTriggeredRef.current = true;
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      }
    }
  }, []);

  return {
    needRefresh,
    updateServiceWorker: applyUpdate,
    forceCheckAndUpdate,
  };
}
