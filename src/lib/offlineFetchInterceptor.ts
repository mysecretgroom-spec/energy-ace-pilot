import { toast } from "sonner";

let lastToastTime = 0;
const TOAST_DEBOUNCE_MS = 3000;

function showOfflineToast() {
  const now = Date.now();
  if (now - lastToastTime < TOAST_DEBOUNCE_MS) return;
  lastToastTime = now;
  toast.error("Action indisponible, vérifiez votre connexion internet", {
    icon: "📡",
    duration: 2500,
  });
}

/**
 * Installs a global fetch interceptor that catches network errors
 * on Supabase mutation requests (POST, PATCH, DELETE) when offline,
 * showing a user-friendly toast instead of crashing.
 */
export function installOfflineFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const method = (init?.method || "GET").toUpperCase();
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

    // Check if effectively offline before mutation requests
    if (isMutation && !navigator.onLine) {
      showOfflineToast();
      return new Response(
        JSON.stringify({ error: "offline", message: "No internet connection" }),
        { status: 0, statusText: "Offline", headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const response = await originalFetch.call(window, input, init);
      return response;
    } catch (error) {
      // Network error (fetch failed entirely — no connectivity)
      if (
        error instanceof TypeError &&
        (error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("Network request failed") ||
          error.message.includes("Load failed"))
      ) {
        if (isMutation) {
          showOfflineToast();
        }
        // For GET requests, let React Query handle the error with cached data
      }
      throw error;
    }
  };
}
