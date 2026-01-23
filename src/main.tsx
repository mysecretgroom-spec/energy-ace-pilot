import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Hide PWA loading screen once React mounts
const hideLoadingScreen = () => {
  const loading = document.getElementById('pwa-loading');
  if (loading) {
    loading.style.opacity = '0';
    loading.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => loading.remove(), 300);
  }
};

// Mount React app first - this is critical for iOS PWA
createRoot(document.getElementById("root")!).render(<App />);

// Hide loading after initial render
requestAnimationFrame(() => {
  requestAnimationFrame(hideLoadingScreen);
});

// Register service worker AFTER app is mounted (non-blocking)
// This prevents the SW registration from blocking the initial render
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Delay SW registration to ensure app is fully loaded
  window.addEventListener('load', () => {
    setTimeout(async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        registerSW({
          immediate: false, // Don't claim immediately on first load
          onRegisteredSW(swUrl, r) {
            console.log('SW registered:', swUrl);
            // Check for updates periodically
            if (r) {
              setInterval(() => {
                r.update();
              }, 60 * 60 * 1000); // Every hour
            }
          },
          onOfflineReady() {
            console.log('App ready for offline use');
          },
        });
      } catch (error) {
        console.warn('SW registration failed:', error);
      }
    }, 2000); // Wait 2 seconds after load
  });
}
