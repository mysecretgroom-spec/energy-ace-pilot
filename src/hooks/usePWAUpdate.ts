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

  // Check for updates when app becomes visible
  const checkForUpdates = useCallback(() => {
    if (!hasGoodConnection()) {
      console.log('[PWA] Skipping update check - poor/no connection');
      return;
    }

    // Trigger SW update check
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          console.log('[PWA] Checking for updates on visibility change...');
          registration.update();
        }
      });
    }
  }, []);

  // Handle visibility change - check for updates when app comes to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    // Check on mount
    checkForUpdates();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also check when coming back online
    window.addEventListener('online', checkForUpdates);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkForUpdates);
    };
  }, [checkForUpdates]);

  // Show toast when update is available
  useEffect(() => {
    if (needRefresh) {
      toast.info('Mise à jour disponible', {
        description: 'Une nouvelle version est prête.',
        action: {
          label: 'Mettre à jour',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        duration: 10000,
      });
    }
  }, [needRefresh, updateServiceWorker]);

  // Auto-update if good connection and update available
  useEffect(() => {
    if (needRefresh && hasGoodConnection()) {
      // Small delay to let user see the toast
      const timer = setTimeout(() => {
        console.log('[PWA] Auto-updating...');
        updateServiceWorker(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);

  return {
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
  };
}
