import { useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// Minimum connection quality for auto-update
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

  if (storedVersion && storedVersion !== CURRENT_SW_VERSION) {
    console.log('[PWA] Version mismatch detected, cleaning up stale caches...', {
      stored: storedVersion,
      current: CURRENT_SW_VERSION,
    });

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[PWA] Cleared', cacheNames.length, 'stale caches');

    localStorage.setItem(SW_VERSION_KEY, CURRENT_SW_VERSION);
    return true;
  }

  localStorage.setItem(SW_VERSION_KEY, CURRENT_SW_VERSION);
  return false;
}

/**
 * Silent auto-update PWA hook.
 * - vite-plugin-pwa is configured with `registerType: "autoUpdate"` and
 *   `skipWaiting: true`, so the new SW activates immediately.
 * - We listen for `controllerchange` and reload the page silently.
 * - Avoids reload storms by guarding with a ref + minimum interval since boot.
 */
export function usePWAUpdate() {
  const reloadingRef = useRef(false);
  const bootTimeRef = useRef(Date.now());

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker registered:', swUrl);

      // Periodically check for updates (every 30 min)
      if (registration) {
        setInterval(() => {
          if (hasGoodConnection()) {
            console.log('[PWA] Periodic update check…');
            registration.update().catch(() => {});
          }
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] SW registration error:', error);
    },
  });

  // Cleanup stale SWs on mount
  useEffect(() => {
    cleanupStaleSWs().then((cleaned) => {
      if (cleaned && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    });
  }, []);

  // Check for updates when app becomes visible
  const checkForUpdates = useCallback(() => {
    if (!hasGoodConnection()) return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      console.log('[PWA] Checking for updates…');
      registration.update().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) checkForUpdates();
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

  // Silent reload when a new SW takes control (after skipWaiting + clientsClaim).
  // Guard: don't reload in the first 3s of boot (avoids reload during initial activation).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      if (reloadingRef.current) return;
      const elapsed = Date.now() - bootTimeRef.current;
      if (elapsed < 3000) {
        console.log('[PWA] Ignoring controllerchange during initial boot');
        return;
      }
      reloadingRef.current = true;
      console.log('[PWA] New SW activated, silent reload…');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  // Manual force-update (used by Settings button)
  const forceCheckAndUpdate = useCallback(async () => {
    const toastId = toast.loading('Vérification des mises à jour…');
    try {
      if (!('serviceWorker' in navigator)) {
        toast.error('Mises à jour non supportées sur ce navigateur', { id: toastId });
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        toast.error('Aucun service worker enregistré', { id: toastId });
        return;
      }
      console.log('[PWA] Force checking for updates…');
      await registration.update();
      await new Promise((r) => setTimeout(r, 1000));

      if (registration.waiting || registration.installing) {
        toast.success('Mise à jour trouvée, application en cours…', { id: toastId });
        // skipWaiting is true → new SW will activate; controllerchange will reload.
        // As a safety net, force reload after 1.5s.
        setTimeout(() => {
          reloadingRef.current = true;
          window.location.reload();
        }, 1500);
        return;
      }

      toast.success('Vous êtes déjà à jour 🎉', { id: toastId });
    } catch (err) {
      console.error('[PWA] Force update failed:', err);
      toast.error('Échec de la vérification', { id: toastId });
    }
  }, []);

  // Expose globally so any component can trigger a check without re-using the hook
  useEffect(() => {
    (window as any).__forcePWAUpdate = forceCheckAndUpdate;
    return () => {
      delete (window as any).__forcePWAUpdate;
    };
  }, [forceCheckAndUpdate]);

  return {
    needRefresh: false,
    updateServiceWorker,
    forceCheckAndUpdate,
  };
}
