import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(Date.now().toString()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // Force Vite à ré-optimiser ses dépendances en dev pour éviter les erreurs
  // "Importing a module script failed" causées par un cache .vite obsolète
  // après l'ajout / suppression de fichiers.
  optimizeDeps: {
    force: mode === "development",
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "emit-version-json",
      apply: "build" as const,
      generateBundle() {
        (this as any).emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: Date.now().toString() }),
        });
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "pwa-icons/*.png"],
      manifest: {
        name: "DébalePro - Gestion commerciale ENR",
        short_name: "RGE app",
        description: "Application de gestion commerciale pour installateurs en énergies renouvelables",
        theme_color: "#2563eb",
        background_color: "#d7dadf",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icons/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "/pwa-icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,webp}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      clientsClaim: true,
      skipWaiting: true,
        importScripts: ["https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/, /^\/~oauth/],
        // Seules les lectures du planning passent par le service worker.
        // Auth, fonctions, stockage et écritures vont directement au réseau :
        // les faire transiter par le SW provoquait des « Load failed » sur iOS.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(rdv|clients|etudes|regies)/i,
            method: "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-data-cache",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
