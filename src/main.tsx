import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installOfflineFetchInterceptor } from "./lib/offlineFetchInterceptor";

// Install offline fetch interceptor before anything else
installOfflineFetchInterceptor();

// Hide loading screen
const loading = document.getElementById('pwa-loading');
if (loading) loading.remove();

// Mount app
createRoot(document.getElementById("root")!).render(<App />);
