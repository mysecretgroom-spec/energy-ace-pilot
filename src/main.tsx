import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Hide loading screen
const loading = document.getElementById('pwa-loading');
if (loading) loading.remove();

// Mount app
createRoot(document.getElementById("root")!).render(<App />);
