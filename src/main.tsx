import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installOfflineFetchInterceptor } from "./lib/offlineFetchInterceptor";

// Install offline fetch interceptor before anything else
installOfflineFetchInterceptor();

// One-shot forced SW reset: bump this token to force ALL clients to unregister
// their service workers + clear caches + reload once on next boot.
const FORCE_SW_RESET_TOKEN = "2026-05-05-reload-broadcast";
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app") ||
    window.location.hostname === "localhost");
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
(async () => {
  if (isPreviewHost || isInIframe) return;
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
