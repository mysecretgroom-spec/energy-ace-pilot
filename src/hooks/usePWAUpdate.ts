import { useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// Minimum connection quality for auto-update (in Mbps estimated)
const MIN_EFFECTIVE_TYPE_FOR_UPDATE = ['4g', '3g'];

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

export function usePWAUpdate() {
  const toastShownRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);
      
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

  // Check for updates when app becomes visible or reopened
  const checkForUpdates = useCallback(() => {
    if (!hasGoodConnection()) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('[PWA] Checking for updates...');
          registration.update();
        }
      });
    }
  }, []);

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

  // Show a persistent toast when update is available (instead of auto-updating)
  useEffect(() => {
    if (needRefresh && !toastShownRef.current) {
      toastShownRef.current = true;
      console.log('[PWA] Update available, showing notification...');

      // Pre-activate the waiting SW so it's ready on refresh
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg?.waiting) {
            console.log('[PWA] Sending SKIP_WAITING to new SW...');
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }

      toast('Nouvelle version disponible 🚀', {
        description: 'Actualisez pour profiter des dernières améliorations.',
        duration: Infinity,
        action: {
          label: 'Actualiser',
          onClick: () => {
            window.location.reload();
          },
        },
        onDismiss: () => {
          toastShownRef.current = false;
        },
      });
    }
  }, [needRefresh]);

  // Listen for the new SW taking control → reload
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        console.log('[PWA] New SW activated, reloading...');
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
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      }
    }
  }, []);

  return {
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
    forceCheckAndUpdate,
  };
}
