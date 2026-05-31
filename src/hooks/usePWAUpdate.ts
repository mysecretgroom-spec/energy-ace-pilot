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
const isPreviewOrIframe = (() => {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes('id-preview--') ||
    host.includes('lovableproject.com') ||
    host.includes('lovable.app');
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  return isPreviewHost || inIframe;
})();

export function usePWAUpdate() {
  const reloadingRef = useRef(false);
  const bootTimeRef = useRef(Date.now());

  // In preview/iframe contexts we short-circuit ALL PWA behavior. We still
  // call the hook (rules of hooks) but with `immediate: false` and no-op
  // callbacks, and we make sure no registration ever happens.
  const { updateServiceWorker } = useRegisterSW({
    immediate: !isPreviewOrIframe,
    onRegisteredSW(swUrl, registration) {
      if (isPreviewOrIframe) {
        registration?.unregister().catch(() => {});
        return;
      }
      console.log('[PWA] Service Worker registered:', swUrl);
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
      if (isPreviewOrIframe) return;
      console.error('[PWA] SW registration error:', error);
    },
  });

  // Belt-and-suspenders: on every mount in preview/iframe, unregister any
  // leftover SW + purge caches so a stale registration can't survive HMR.
  useEffect(() => {
    if (!isPreviewOrIframe) return;
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        }
        if ('caches' in self) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
        }
      } catch {}
    })();
  }, []);


  // Cleanup stale SWs on mount (skip in preview/iframe — already neutralized)
  useEffect(() => {
    if (isPreviewOrIframe) return;
    cleanupStaleSWs().then((cleaned) => {
      if (cleaned && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    });
  }, []);

  // Compare deployed version vs current bundle; reload if a NEWER build is live.
  // Anti-loop:
  //  - sessionStorage tracks the last remote version we already reloaded for
  //  - minimum interval between fetches
  //  - hard cap of 2 reloads per session in case version.json itself is broken
  const RELOADED_VERSION_KEY = '__pwa_reloaded_for_version__';
  const RELOAD_COUNT_KEY = '__pwa_reload_count__';
  const MAX_RELOADS_PER_SESSION = 2;
  const lastVersionCheckRef = useRef(0);

  const checkVersionAndReloadIfStale = useCallback(async (minIntervalMs = 60_000) => {
    if (!hasGoodConnection()) return false;
    if (reloadingRef.current) return false;
    const now = Date.now();
    if (now - lastVersionCheckRef.current < minIntervalMs) return false;
    lastVersionCheckRef.current = now;
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const remote = data?.version || data?.appVersion;
      if (!remote || remote === CURRENT_SW_VERSION) return false;

      // Already reloaded for this exact remote version → don't loop
      const alreadyReloadedFor = sessionStorage.getItem(RELOADED_VERSION_KEY);
      if (alreadyReloadedFor === String(remote)) {
        console.log('[PWA] Skip reload: already reloaded for', remote);
        return false;
      }

      // Hard cap per session
      const count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0');
      if (count >= MAX_RELOADS_PER_SESSION) {
        console.warn('[PWA] Reload cap reached for this session, skipping');
        return false;
      }

      sessionStorage.setItem(RELOADED_VERSION_KEY, String(remote));
      sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
      reloadingRef.current = true;
      console.log('[PWA] Newer version available, reloading…', { remote, current: CURRENT_SW_VERSION });

      // Optional: purge runtime caches so stale assets don't survive the reload.
      // Keep Supabase storage cache (heavy media) to avoid re-downloading user files.
      try {
        if ('caches' in self) {
          const names = await caches.keys();
          const toDelete = names.filter((n) => !/supabase-storage-cache/i.test(n));
          await Promise.all(toDelete.map((n) => caches.delete(n).catch(() => false)));
          console.log('[PWA] Purged', toDelete.length, 'stale caches before reload');
        }
      } catch (err) {
        console.warn('[PWA] Cache purge failed (non-blocking):', err);
      }

      localStorage.setItem(SW_VERSION_KEY, String(remote));
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  }, []);

  // Check for updates when app becomes visible
  const checkForUpdates = useCallback(() => {
    if (isPreviewOrIframe) return;
    if (!hasGoodConnection()) return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      console.log('[PWA] Checking for updates…');
      registration.update().catch(() => {});
    });

    checkVersionAndReloadIfStale();
  }, [checkVersionAndReloadIfStale]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    // bfcache restore: ALWAYS verify against version.json (the only reliable
    // signal of a newer deploy). The version check itself prevents loops.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      console.log('[PWA] bfcache restore detected → version check');
      lastVersionCheckRef.current = 0; // bypass throttle
      checkVersionAndReloadIfStale(0);
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
