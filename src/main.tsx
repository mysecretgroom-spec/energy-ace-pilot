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

createRoot(document.getElementById("root")!).render(<App />);

// Hide loading after initial render
requestAnimationFrame(() => {
  requestAnimationFrame(hideLoadingScreen);
});
