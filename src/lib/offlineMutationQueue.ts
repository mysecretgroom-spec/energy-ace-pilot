/**
 * Offline Mutation Queue
 * Stores failed/offline mutations in IndexedDB and replays them when back online.
 */

const DB_NAME = "debalepro_offline";
const DB_VERSION = 3;
const STORE_NAME = "pending_mutations";

export interface PendingMutation {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  description: string;
  createdAt: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        const error = request.error;
        if (error?.name === "VersionError") {
          console.warn("[MutationQueue] VersionError, deleting stale DB...");
          const del = indexedDB.deleteDatabase(DB_NAME);
          del.onsuccess = () => {
            const retry = indexedDB.open(DB_NAME, DB_VERSION);
            retry.onerror = () => reject(retry.error);
            retry.onsuccess = () => resolve(retry.result);
            retry.onupgradeneeded = (ev) => createAllSharedStores((ev.target as IDBOpenDBRequest).result);
          };
          del.onerror = () => reject(error);
        } else {
          reject(error);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        createMutationStores((event.target as IDBOpenDBRequest).result);
      };
    } catch (error) {
      reject(error);
    }
  });
}

function createAllSharedStores(db: IDBDatabase) {
  // IMPORTANT: Both offlineMutationQueue and useOfflineDocuments share this DB.
  // ALL stores must be created here to avoid missing-store errors from race conditions.
  if (!db.objectStoreNames.contains("pending_documents")) {
    const docStore = db.createObjectStore("pending_documents", { keyPath: "id" });
    docStore.createIndex("userId", "userId", { unique: false });
    docStore.createIndex("clientId", "clientId", { unique: false });
    docStore.createIndex("createdAt", "createdAt", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("createdAt", "createdAt", { unique: false });
    store.createIndex("status", "status", { unique: false });
  }
}

/** Derive a human-readable description from the request */
function describeRequest(url: string, method: string, body: string | null): string {
  const urlObj = new URL(url, window.location.origin);
  const path = urlObj.pathname;

  // Try to extract table name from Supabase REST URL
  const restMatch = path.match(/\/rest\/v1\/(\w+)/);
  const tableName = restMatch?.[1];

  const tableLabels: Record<string, string> = {
    rdv: "RDV",
    clients: "Client",
    ventes: "Vente",
    etudes: "Étude",
    documents: "Document",
    frais: "Note de frais",
    commissions: "Commission",
    bouquets: "Bouquet",
    confirmateurs: "Confirmateur",
  };

  const label = tableName ? (tableLabels[tableName] || tableName) : "donnée";

  const actionMap: Record<string, string> = {
    POST: `Création ${label}`,
    PATCH: `Modification ${label}`,
    PUT: `Mise à jour ${label}`,
    DELETE: `Suppression ${label}`,
  };

  return actionMap[method] || `${method} ${label}`;
}

/** Queue a mutation for later replay */
export async function queueMutation(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null
): Promise<string> {
  const mutation: PendingMutation = {
    id: crypto.randomUUID(),
    url,
    method,
    headers,
    body,
    description: describeRequest(url, method, body),
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const req = store.add(mutation);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Dispatch event so UI can update
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));

  return mutation.id;
}

/** Get all pending mutations */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");

    return new Promise((resolve, reject) => {
      const req = index.getAll(IDBKeyRange.only("pending"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Get count of pending mutations */
export async function getPendingMutationCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");

    return new Promise((resolve, reject) => {
      const req = index.count(IDBKeyRange.only("pending"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** Delete a mutation from the store */
async function deleteMutation(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface ReplayResult {
  total: number;
  succeeded: string[];
  failed: { description: string; error: string }[];
}

/** Replay all pending mutations using the ORIGINAL fetch */
export async function replayPendingMutations(
  originalFetch: typeof window.fetch
): Promise<ReplayResult> {
  const pending = await getPendingMutations();
  const result: ReplayResult = { total: pending.length, succeeded: [], failed: [] };

  if (pending.length === 0) return result;

  for (const mutation of pending) {
    try {
      const response = await originalFetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });

      if (response.ok || response.status < 500) {
        result.succeeded.push(mutation.description);
        await deleteMutation(mutation.id);
      } else {
        const text = await response.text().catch(() => "");
        result.failed.push({ description: mutation.description, error: `HTTP ${response.status}: ${text.slice(0, 100)}` });
        await deleteMutation(mutation.id); // Don't keep permanently broken mutations
      }
    } catch (error) {
      result.failed.push({
        description: mutation.description,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      });
      // Keep for next retry if it's a network error
    }
  }

  window.dispatchEvent(new CustomEvent("offline-queue-changed"));

  return result;
}
