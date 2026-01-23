import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker with auto-update
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    console.log('SW registered:', swUrl);
    // Check for updates every hour
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
});

// Hide PWA loading screen once React mounts
const hideLoadingScreen = () => {
  const loading = document.getElementById('pwa-loading');
  if (loading) {
    loading.style.opacity = '0';
    loading.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => loading.remove(), 300);
  }
};

createRoot(document.getElementById("root")!).render(<App />);

// Hide loading after initial render
requestAnimationFrame(() => {
  requestAnimationFrame(hideLoadingScreen);
});
