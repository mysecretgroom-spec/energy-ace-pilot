import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Hide PWA loading screen immediately after React mounts
const hideLoadingScreen = () => {
  const loading = document.getElementById('pwa-loading');
  if (loading) {
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 200);
  }
};

// Mount React app synchronously
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Hide loading screen immediately
hideLoadingScreen();

// Register service worker only in production, with significant delay
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  setTimeout(async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: false });
    } catch (e) {
      console.warn('SW error:', e);
    }
  }, 5000);
}
