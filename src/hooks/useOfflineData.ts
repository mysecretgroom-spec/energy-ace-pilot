import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const DB_NAME = "debalepro_offline_v2";
const DB_VERSION = 2;

// Store names
const STORES = {
  ETUDES: "pending_etudes",
  RDV: "cached_rdv",
  CLIENTS: "cached_clients",
  WHATSAPP_QUEUE: "whatsapp_queue",
} as const;

export interface PendingEtude {
  id: string;
  localId: string; // UUID generated locally
  userId: string;
  clientId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  syncError?: string;
}

export interface CachedRdv {
  id: string;
  userId: string;
  data: Record<string, unknown>;
  cachedAt: string;
}

export interface CachedClient {
  id: string;
  userId: string;
  data: Record<string, unknown>;
  cachedAt: string;
}

export interface WhatsAppQueueItem {
  id: string;
  userId: string;
  phoneNumber: string;
  message: string;
  template?: string;
  createdAt: string;
  status: "pending" | "sending" | "sent" | "failed";
  retryCount: number;
  error?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Études pending store
        if (!db.objectStoreNames.contains(STORES.ETUDES)) {
          const etudesStore = db.createObjectStore(STORES.ETUDES, { keyPath: "localId" });
          etudesStore.createIndex("userId", "userId", { unique: false });
          etudesStore.createIndex("clientId", "clientId", { unique: false });
          etudesStore.createIndex("synced", "synced", { unique: false });
        }

        // RDV cache store
        if (!db.objectStoreNames.contains(STORES.RDV)) {
          const rdvStore = db.createObjectStore(STORES.RDV, { keyPath: "id" });
          rdvStore.createIndex("userId", "userId", { unique: false });
        }

        // Clients cache store
        if (!db.objectStoreNames.contains(STORES.CLIENTS)) {
          const clientsStore = db.createObjectStore(STORES.CLIENTS, { keyPath: "id" });
          clientsStore.createIndex("userId", "userId", { unique: false });
        }

        // WhatsApp queue store
        if (!db.objectStoreNames.contains(STORES.WHATSAPP_QUEUE)) {
          const whatsappStore = db.createObjectStore(STORES.WHATSAPP_QUEUE, { keyPath: "id" });
          whatsappStore.createIndex("userId", "userId", { unique: false });
          whatsappStore.createIndex("status", "status", { unique: false });
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function useOfflineData() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingEtudesCount, setPendingEtudesCount] = useState(0);
  const [pendingWhatsAppCount, setPendingWhatsAppCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncAll();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load counts on mount
  useEffect(() => {
    if (user) {
      loadCounts();
    }
  }, [user]);

  const loadCounts = async () => {
    if (!user) return;

    try {
      const db = await openDatabase();

      // Count pending études
      const etudeTx = db.transaction(STORES.ETUDES, "readonly");
      const etudeStore = etudeTx.objectStore(STORES.ETUDES);
      const etudeIndex = etudeStore.index("synced");
      const etudeRequest = etudeIndex.count(IDBKeyRange.only(false));
      etudeRequest.onsuccess = () => setPendingEtudesCount(etudeRequest.result);

      // Count pending WhatsApp
      const whatsappTx = db.transaction(STORES.WHATSAPP_QUEUE, "readonly");
      const whatsappStore = whatsappTx.objectStore(STORES.WHATSAPP_QUEUE);
      const whatsappIndex = whatsappStore.index("status");
      const whatsappRequest = whatsappIndex.count(IDBKeyRange.only("pending"));
      whatsappRequest.onsuccess = () => setPendingWhatsAppCount(whatsappRequest.result);
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTUDES OFFLINE
  // ═══════════════════════════════════════════════════════════════════════════
  const saveEtudeOffline = useCallback(
    async (clientId: string, data: Record<string, unknown>, existingLocalId?: string): Promise<string> => {
      if (!user) throw new Error("User not authenticated");

      const localId = existingLocalId || crypto.randomUUID();
      const now = new Date().toISOString();

      const pendingEtude: PendingEtude = {
        id: (data.id as string) || "",
        localId,
        userId: user.id,
        clientId,
        data: { ...data, user_id: user.id, client_id: clientId },
        createdAt: existingLocalId ? (data.createdAt as string) || now : now,
        updatedAt: now,
        synced: false,
      };

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.ETUDES, "readwrite");
        const store = tx.objectStore(STORES.ETUDES);

        await new Promise<void>((resolve, reject) => {
          const request = store.put(pendingEtude);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        setPendingEtudesCount((prev) => prev + (existingLocalId ? 0 : 1));

        if (!isOnline) {
          toast({
            title: "Étude enregistrée hors-ligne",
            description: "Elle sera synchronisée automatiquement",
          });
        }

        return localId;
      } catch (error) {
        console.error("Error saving étude offline:", error);
        throw error;
      }
    },
    [user, isOnline, toast]
  );

  const getOfflineEtude = useCallback(
    async (localId: string): Promise<PendingEtude | null> => {
      if (!user) return null;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.ETUDES, "readonly");
        const store = tx.objectStore(STORES.ETUDES);

        return new Promise((resolve, reject) => {
          const request = store.get(localId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("Error getting offline étude:", error);
        return null;
      }
    },
    [user]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RDV CACHE (for planning offline)
  // ═══════════════════════════════════════════════════════════════════════════
  const cacheRdvList = useCallback(
    async (rdvList: Record<string, unknown>[]) => {
      if (!user) return;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.RDV, "readwrite");
        const store = tx.objectStore(STORES.RDV);

        // Clear old cache
        await new Promise<void>((resolve) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve(); // Continue even if clear fails
        });

        // Add new entries
        const now = new Date().toISOString();
        for (const rdv of rdvList) {
          const cachedRdv: CachedRdv = {
            id: rdv.id as string,
            userId: user.id,
            data: rdv,
            cachedAt: now,
          };
          store.put(cachedRdv);
        }
      } catch (error) {
        console.error("Error caching RDV:", error);
      }
    },
    [user]
  );

  const getCachedRdvList = useCallback(async (): Promise<Record<string, unknown>[]> => {
    if (!user) return [];

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.RDV, "readonly");
      const store = tx.objectStore(STORES.RDV);
      const index = store.index("userId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(user.id));
        request.onsuccess = () => {
          const results = request.result as CachedRdv[];
          resolve(results.map((r) => r.data));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached RDV:", error);
      return [];
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // WHATSAPP QUEUE (for offline status changes)
  // ═══════════════════════════════════════════════════════════════════════════
  const queueWhatsAppMessage = useCallback(
    async (phoneNumber: string, message: string, template?: string): Promise<string> => {
      if (!user) throw new Error("User not authenticated");

      const item: WhatsAppQueueItem = {
        id: crypto.randomUUID(),
        userId: user.id,
        phoneNumber,
        message,
        template,
        createdAt: new Date().toISOString(),
        status: "pending",
        retryCount: 0,
      };

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.WHATSAPP_QUEUE, "readwrite");
        const store = tx.objectStore(STORES.WHATSAPP_QUEUE);

        await new Promise<void>((resolve, reject) => {
          const request = store.add(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        setPendingWhatsAppCount((prev) => prev + 1);

        if (!isOnline) {
          toast({
            title: "Message WhatsApp en attente",
            description: "Il sera envoyé dès le retour de connexion",
          });
        }

        return item.id;
      } catch (error) {
        console.error("Error queuing WhatsApp message:", error);
        throw error;
      }
    },
    [user, isOnline, toast]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC ALL
  // ═══════════════════════════════════════════════════════════════════════════
  const syncAll = useCallback(async () => {
    if (!user || !isOnline || isSyncing) return;

    setIsSyncing(true);
    let syncedEtudes = 0;
    let syncedWhatsApp = 0;

    try {
      const db = await openDatabase();

      // Sync pending études
      const etudeTx = db.transaction(STORES.ETUDES, "readwrite");
      const etudeStore = etudeTx.objectStore(STORES.ETUDES);
      const etudeIndex = etudeStore.index("synced");

      const pendingEtudes: PendingEtude[] = await new Promise((resolve, reject) => {
        const request = etudeIndex.getAll(IDBKeyRange.only(false));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      for (const etude of pendingEtudes) {
        try {
          if (etude.id) {
            // Update existing - use any cast for offline data flexibility
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from("etudes").update(etude.data as any).eq("id", etude.id);
          } else {
            // Insert new - use any cast for offline data flexibility
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newEtude } = await supabase
              .from("etudes")
              .insert(etude.data as any)
              .select()
              .single();
            if (newEtude) {
              etude.id = newEtude.id;
            }
          }

          // Mark as synced
          etude.synced = true;
          const updateTx = db.transaction(STORES.ETUDES, "readwrite");
          updateTx.objectStore(STORES.ETUDES).put(etude);
          syncedEtudes++;
        } catch (error) {
          console.error("Error syncing étude:", etude.localId, error);
          etude.syncError = String(error);
          const errorTx = db.transaction(STORES.ETUDES, "readwrite");
          errorTx.objectStore(STORES.ETUDES).put(etude);
        }
      }

      // Sync WhatsApp queue
      const whatsappTx = db.transaction(STORES.WHATSAPP_QUEUE, "readwrite");
      const whatsappStore = whatsappTx.objectStore(STORES.WHATSAPP_QUEUE);
      const whatsappIndex = whatsappStore.index("status");

      const pendingWhatsApp: WhatsAppQueueItem[] = await new Promise((resolve, reject) => {
        const request = whatsappIndex.getAll(IDBKeyRange.only("pending"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      for (const item of pendingWhatsApp) {
        try {
          await supabase.functions.invoke("whatsapp-send", {
            body: {
              to: item.phoneNumber,
              message: item.message,
              template: item.template,
            },
          });

          // Remove from queue
          const deleteTx = db.transaction(STORES.WHATSAPP_QUEUE, "readwrite");
          deleteTx.objectStore(STORES.WHATSAPP_QUEUE).delete(item.id);
          syncedWhatsApp++;
        } catch (error) {
          console.error("Error sending WhatsApp:", item.id, error);
          item.retryCount++;
          item.error = String(error);
          if (item.retryCount >= 3) {
            item.status = "failed";
          }
          const updateTx = db.transaction(STORES.WHATSAPP_QUEUE, "readwrite");
          updateTx.objectStore(STORES.WHATSAPP_QUEUE).put(item);
        }
      }

      if (syncedEtudes > 0 || syncedWhatsApp > 0) {
        toast({
          title: "Synchronisation terminée",
          description: `${syncedEtudes} étude(s) et ${syncedWhatsApp} message(s) synchronisés`,
        });
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
      await loadCounts();
    }
  }, [user, isOnline, isSyncing, toast]);

  return {
    isOnline,
    isSyncing,
    pendingEtudesCount,
    pendingWhatsAppCount,
    saveEtudeOffline,
    getOfflineEtude,
    cacheRdvList,
    getCachedRdvList,
    queueWhatsAppMessage,
    syncAll,
  };
}
