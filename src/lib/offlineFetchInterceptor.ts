import { toast } from "sonner";
import { queueMutation, replayPendingMutations, type ReplayResult } from "./offlineMutationQueue";

let originalFetch: typeof window.fetch;
let isReplaying = false;

function showQueuedToast() {
  toast.info("Action enregistrée hors-ligne", {
    icon: "📥",
    description: "Elle sera exécutée au retour de la connexion",
    duration: 2000,
  });
}

function showReplayResultToast(result: ReplayResult) {
  if (result.total === 0) return;

  const successList = result.succeeded.map((d) => `✅ ${d}`).join("\n");
  const failList = result.failed.map((f) => `❌ ${f.description}`).join("\n");

  const allSucceeded = result.failed.length === 0;
  const allFailed = result.succeeded.length === 0;

  if (allSucceeded) {
    toast.success(`${result.succeeded.length} action(s) synchronisée(s)`, {
      icon: "🔄",
      description: successList,
      duration: 5000,
    });
  } else if (allFailed) {
    toast.error(`${result.failed.length} action(s) échouée(s)`, {
      icon: "⚠️",
      description: failList,
      duration: 6000,
    });
  } else {
    toast.info("Synchronisation partielle", {
      icon: "🔄",
      description: `${successList}\n${failList}`,
      duration: 6000,
    });
  }
}

/**
 * Installs a global fetch interceptor that queues mutations when offline
 * and replays them when connectivity returns.
 */
export function installOfflineFetchInterceptor() {
  originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const method = (init?.method || "GET").toUpperCase();
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

    // Don't intercept during replay
    if (isReplaying) {
      return originalFetch(input, init);
    }

    // Queue mutations when offline
    if (isMutation && !navigator.onLine) {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

      // Extract headers
      const headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => { headers[k] = v; });
        } else {
          Object.entries(init.headers).forEach(([k, v]) => { headers[k] = String(v); });
        }
      }

      const body = typeof init?.body === "string" ? init.body : null;

      await queueMutation(url, method, headers, body);
      showQueuedToast();

      // Return a fake successful response so the UI doesn't error
      return new Response(
        JSON.stringify({ offline_queued: true }),
        { status: 200, statusText: "Queued", headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      return await originalFetch(input, init);
    } catch (error) {
      if (
        error instanceof TypeError &&
        isMutation &&
        (error.message.includes("Failed to fetch") ||
          error.message.includes("NetworkError") ||
          error.message.includes("Load failed"))
      ) {
        // Network failed mid-request — queue it
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const headers: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((v, k) => { headers[k] = v; });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([k, v]) => { headers[k] = v; });
          } else {
            Object.entries(init.headers).forEach(([k, v]) => { headers[k] = String(v); });
          }
        }
        const body = typeof init?.body === "string" ? init.body : null;

        await queueMutation(url, method, headers, body);
        showQueuedToast();

        return new Response(
          JSON.stringify({ offline_queued: true }),
          { status: 200, statusText: "Queued", headers: { "Content-Type": "application/json" } }
        );
      }
      throw error;
    }
  };

  // Listen for online event to replay queued mutations
  window.addEventListener("online", async () => {
    // Small delay to let connection stabilize
    await new Promise((r) => setTimeout(r, 1500));

    if (!navigator.onLine || isReplaying) return;

    isReplaying = true;
    try {
      const result = await replayPendingMutations(originalFetch);
      showReplayResultToast(result);
    } catch (error) {
      console.error("Error replaying offline mutations:", error);
    } finally {
      isReplaying = false;
    }
  });
}
