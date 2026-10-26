import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { clearLegacyMutationQueue } from "./lib/clearLegacyMutationQueue";
import { installFetchDedupe } from "./lib/fetchDedupe";

installFetchDedupe();

// Purge des anciens caches du service worker (auth/fonctions/stockage mis en cache à tort).
if (typeof caches !== "undefined") {
  ["supabase-cache", "supabase-storage-cache"].forEach((n) => caches.delete(n).catch(() => {}));
}

// Plus d'interception globale du réseau : le hors-ligne est limité au planning
// (cache de lecture) et à l'outil d'étude (brouillons). On purge l'ancienne file.
clearLegacyMutationQueue();

// Detect Lovable preview / iframe contexts where service workers MUST NOT run.
// Stale SWs in preview iframes serve outdated bundles and break dynamic imports.
const __host = typeof window !== "undefined" ? window.location.hostname : "";
const isLovablePreviewHost =
  __host.includes("id-preview--") ||
  __host.includes("lovableproject.com") ||
  __host.includes("lovable.app");
const isPreviewHost = isLovablePreviewHost || __host === "localhost";
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewOrIframe = isPreviewHost || isInIframe;

// Hard guard: neutralize SW registration entirely in preview/iframe contexts
// so no plugin (vite-plugin-pwa, OneSignal, third-party) can register one.
if (isPreviewOrIframe && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  try {
    const sw = navigator.serviceWorker;
    const origRegister = sw.register.bind(sw);
    (sw as any).register = (..._args: unknown[]) => {
      console.log("[SW] Registration blocked in preview/iframe context");
      return Promise.reject(new Error("SW registration blocked in preview/iframe"));
    };
    // Keep reference in case we ever need to restore (we don't, but useful for debug)
    (window as any).__origSWRegister = origRegister;
  } catch (e) {
    console.warn("[SW] Failed to patch register():", e);
  }
  // Eagerly unregister anything already installed + purge caches.
  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      if ("caches" in self) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
      }
    } catch {}
  })();
}

// One-shot forced SW reset for PRODUCTION clients only.
const FORCE_SW_RESET_TOKEN = "2026-05-30-sw-chunk-fix";
(async () => {
  if (isPreviewOrIframe) return;
  try {
    const done = localStorage.getItem("__force_sw_reset__");
    if (done === FORCE_SW_RESET_TOKEN) return;
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in self) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
    localStorage.setItem("__force_sw_reset__", FORCE_SW_RESET_TOKEN);
    console.log("[SW] Forced reset done, reloading…");
    window.location.reload();
  } catch (e) {
    console.warn("[SW] Forced reset failed:", e);
    localStorage.setItem("__force_sw_reset__", FORCE_SW_RESET_TOKEN);
  }
})();

// Handle stale dynamic-import chunks after a redeploy: reload once to fetch fresh bundle.
const RELOAD_KEY = "__chunk_reload_attempt__";
const isChunkLoadError = (msg: string) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i.test(
    msg || ""
  );
const tryReload = () => {
  // Hors ligne, recharger afficherait la page « pas d'internet » : on garde l'app ouverte.
  if (navigator.onLine === false) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
};
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e?.message)) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason && (e.reason.message || String(e.reason))) || "";
  if (isChunkLoadError(msg)) tryReload();
});

// Hide loading screen
const loading = document.getElementById('pwa-loading');
if (loading) loading.remove();

// Mount app
createRoot(document.getElementById("root")!).render(<App />);
