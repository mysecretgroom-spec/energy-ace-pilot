/**
 * Stockage hors-ligne du « dossier de la journée » et de la file d'écritures.
 * Base IndexedDB séparée de l'ancien cache pour éviter toute migration risquée.
 */
const DB_NAME = "debalepro_rdv_pack";
const DB_VERSION = 1;
export const KV_STORE = "kv";
export const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB indisponible"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

export async function kvGet<T = unknown>(key: string): Promise<T | undefined> {
  try { return await run<T | undefined>(KV_STORE, "readonly", (s) => s.get(key)); } catch { return undefined; }
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  try { await run(KV_STORE, "readwrite", (s) => s.put(value, key)); } catch { /* quota / indispo */ }
}

export async function storeGetAll<T>(store: string): Promise<T[]> {
  try { return await run<T[]>(store, "readonly", (s) => s.getAll()); } catch { return []; }
}
export async function storePut(store: string, value: unknown): Promise<void> {
  await run(store, "readwrite", (s) => s.put(value));
}
export async function storeDelete(store: string, key: string): Promise<void> {
  await run(store, "readwrite", (s) => s.delete(key));
}
