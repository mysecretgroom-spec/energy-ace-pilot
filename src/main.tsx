import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installOfflineFetchInterceptor } from "./lib/offlineFetchInterceptor";

// Install offline fetch interceptor before anything else
installOfflineFetchInterceptor();

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
