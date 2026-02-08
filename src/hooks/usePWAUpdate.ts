import { useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// Minimum connection quality for auto-update (in Mbps estimated)
const MIN_EFFECTIVE_TYPE_FOR_UPDATE = ['4g', '3g'];

function hasGoodConnection(): boolean {
  // Check if online first
  if (!navigator.onLine) {
    return false;
  }

  // Check Network Information API if available
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;

  if (connection) {
    // Check effective type (4g, 3g, 2g, slow-2g)
    const effectiveType = connection.effectiveType;
    if (effectiveType && !MIN_EFFECTIVE_TYPE_FOR_UPDATE.includes(effectiveType)) {
      console.log('[PWA] Slow connection detected:', effectiveType);
      return false;
    }

    // Check if save-data mode is enabled
    if (connection.saveData) {
      console.log('[PWA] Save-data mode enabled, skipping update');
      return false;
    }

    // Check downlink speed (Mbps) - skip if very slow
    if (connection.downlink !== undefined && connection.downlink < 0.5) {
      console.log('[PWA] Very slow downlink:', connection.downlink, 'Mbps');
      return false;
    }
  }

  return true;
}

export function usePWAUpdate() {
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

  // Listen for the new SW taking control and reload immediately
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New SW activated, reloading...');
        window.location.reload();
      });
    }
  }, []);

  // Check for updates when app becomes visible
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

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    checkForUpdates();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkForUpdates);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkForUpdates);
    };
  }, [checkForUpdates]);

  // Auto-update immediately when available with good connection
  useEffect(() => {
    if (needRefresh && hasGoodConnection()) {
      console.log('[PWA] Auto-updating immediately...');
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  const forceCheckAndUpdate = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        console.log('[PWA] Force checking for updates...');
        await registration.update();
        // If a waiting worker exists, activate it immediately
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
