import { pendingRdvPatches } from "@/lib/offline/outbox";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";

const DB_NAME = "debalepro_offline_v3";
const DB_VERSION = 3;

// Store names
const STORES = {
  ETUDES: "pending_etudes",
  RDV: "cached_rdv",
  CLIENTS: "cached_clients",
  WHATSAPP_QUEUE: "whatsapp_queue",
  PROFILE: "cached_profile",
  REGIES: "cached_regies",
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

export interface CachedProfile {
  userId: string;
  data: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    numero_agrement: string | null;
    telephone_pro: string | null;
    nom_scene: string | null;
    prenom_scene: string | null;
  };
  cachedAt: string;
}

export interface CachedRegie {
  id: string;
  userId: string;
  data: {
    id: string;
    nom: string;
    siret: string | null;
    couleur: string | null;
    is_hejja: boolean;
  };
  cachedAt: string;
}

const REQUIRED_STORES_SCHEMA: Record<string, { keyPath: string | string[]; indexes: Record<string, string | string[]> }> = {
  [STORES.ETUDES]: {
    keyPath: "localId",
    indexes: { userId: "userId", clientId: "clientId", synced: "synced" },
  },
  [STORES.RDV]: {
    keyPath: "id",
    indexes: { userId: "userId" },
  },
  [STORES.CLIENTS]: {
    keyPath: "id",
    indexes: { userId: "userId" },
  },
  [STORES.WHATSAPP_QUEUE]: {
    keyPath: "id",
    indexes: { userId: "userId", status: "status" },
  },
  [STORES.PROFILE]: {
    keyPath: "userId",
    indexes: {},
  },
  [STORES.REGIES]: {
    keyPath: "id",
    indexes: { userId: "userId" },
  },
};

const isSameKeyPath = (
  actual: string | string[] | null,
  expected: string | string[]
): boolean => {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.length === actual.length && expected.every((key, idx) => key === actual[idx]);
  }
  return actual === expected;
};

function createStores(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(STORES.ETUDES)) {
    const etudesStore = db.createObjectStore(STORES.ETUDES, { keyPath: "localId" });
    etudesStore.createIndex("userId", "userId", { unique: false });
    etudesStore.createIndex("clientId", "clientId", { unique: false });
    etudesStore.createIndex("synced", "synced", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.RDV)) {
    const rdvStore = db.createObjectStore(STORES.RDV, { keyPath: "id" });
    rdvStore.createIndex("userId", "userId", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.CLIENTS)) {
    const clientsStore = db.createObjectStore(STORES.CLIENTS, { keyPath: "id" });
    clientsStore.createIndex("userId", "userId", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.WHATSAPP_QUEUE)) {
    const whatsappStore = db.createObjectStore(STORES.WHATSAPP_QUEUE, { keyPath: "id" });
    whatsappStore.createIndex("userId", "userId", { unique: false });
    whatsappStore.createIndex("status", "status", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.PROFILE)) {
    db.createObjectStore(STORES.PROFILE, { keyPath: "userId" });
  }
  if (!db.objectStoreNames.contains(STORES.REGIES)) {
    const regiesStore = db.createObjectStore(STORES.REGIES, { keyPath: "id" });
    regiesStore.createIndex("userId", "userId", { unique: false });
  }
}

function hasValidSchema(db: IDBDatabase): boolean {
  const requiredStores = Object.keys(REQUIRED_STORES_SCHEMA);
  if (!requiredStores.every((storeName) => db.objectStoreNames.contains(storeName))) {
    return false;
  }

  const tx = db.transaction(requiredStores, "readonly");
  return requiredStores.every((storeName) => {
    const schema = REQUIRED_STORES_SCHEMA[storeName];
    const store = tx.objectStore(storeName);

    if (!isSameKeyPath(store.keyPath, schema.keyPath)) {
      return false;
    }

    return Object.entries(schema.indexes).every(([indexName, keyPath]) => {
      if (!store.indexNames.contains(indexName)) return false;
      return isSameKeyPath(store.index(indexName).keyPath, keyPath);
    });
  });
}

function deleteOfflineDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB delete blocked"));
  });
}

function openDatabaseRequest(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => createStores((event.target as IDBOpenDBRequest).result);
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!window.indexedDB) {
    throw new Error("IndexedDB not available");
  }

  let hasRecovered = false;

  while (true) {
    try {
      const db = await openDatabaseRequest();

      if (hasValidSchema(db)) {
        return db;
      }

      db.close();
      if (hasRecovered) {
        throw new Error("IndexedDB schema invalid after recovery");
      }

      console.warn("[OfflineData] Invalid IndexedDB schema detected, recreating database...");
      await deleteOfflineDatabase();
      hasRecovered = true;
    } catch (error) {
      const errorName =
        error instanceof Error && "name" in error
          ? (error as Error).name
          : "";

      const isRecoverableError = errorName === "VersionError" || errorName === "InvalidStateError";

      if (!isRecoverableError || hasRecovered) {
        throw error;
      }

      console.warn(`[OfflineData] ${errorName} detected, recreating database...`);
      await deleteOfflineDatabase();
      hasRecovered = true;
    }
  }
}

export function useOfflineData() {
  const { isEffectivelyOffline, isOnline } = useConnectionQuality();
  const [pendingEtudesCount, setPendingEtudesCount] = useState(0);
  const [pendingWhatsAppCount, setPendingWhatsAppCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncAll();
    }
  }, [isOnline]);

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
      const etudeRequest = etudeStore.getAll();
      etudeRequest.onsuccess = () =>
        setPendingEtudesCount((etudeRequest.result as Array<{ synced?: boolean }>).filter((e) => !e.synced).length);

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
          // Superpose les changements de statut faits hors-ligne et pas encore envoyés.
          pendingRdvPatches()
            .then((patches) => resolve(results.map((r) => {
              const patch = patches.get(String(r.data.id));
              return patch ? { ...r.data, ...patch } : r.data;
            })))
            .catch(() => resolve(results.map((r) => r.data)));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached RDV:", error);
      return [];
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS CACHE (for études offline)
  // ═══════════════════════════════════════════════════════════════════════════
  const cacheClientsList = useCallback(
    async (clientsList: Record<string, unknown>[]) => {
      if (!user) return;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.CLIENTS, "readwrite");
        const store = tx.objectStore(STORES.CLIENTS);

        // Clear old cache
        await new Promise<void>((resolve) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });

        // Add new entries
        const now = new Date().toISOString();
        for (const client of clientsList) {
          const cachedClient: CachedClient = {
            id: client.id as string,
            userId: user.id,
            data: client,
            cachedAt: now,
          };
          store.put(cachedClient);
        }
      } catch (error) {
        console.error("Error caching clients:", error);
      }
    },
    [user]
  );

  const getCachedClientsList = useCallback(async (): Promise<Record<string, unknown>[]> => {
    if (!user) return [];

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CLIENTS, "readonly");
      const store = tx.objectStore(STORES.CLIENTS);
      const index = store.index("userId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(user.id));
        request.onsuccess = () => {
          const results = request.result as CachedClient[];
          resolve(results.map((r) => r.data));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached clients:", error);
      return [];
    }
  }, [user]);

  const getCachedClient = useCallback(async (clientId: string): Promise<Record<string, unknown> | null> => {
    if (!user) return null;

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.CLIENTS, "readonly");
      const store = tx.objectStore(STORES.CLIENTS);

      return new Promise((resolve, reject) => {
        const request = store.get(clientId);
        request.onsuccess = () => {
          const result = request.result as CachedClient | undefined;
          resolve(result?.data || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached client:", error);
      return null;
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE CACHE (for RGE Card offline)
  // ═══════════════════════════════════════════════════════════════════════════
  const cacheProfile = useCallback(
    async (profileData: CachedProfile["data"]) => {
      if (!user) return;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.PROFILE, "readwrite");
        const store = tx.objectStore(STORES.PROFILE);

        const cachedProfile: CachedProfile = {
          userId: user.id,
          data: profileData,
          cachedAt: new Date().toISOString(),
        };

        await new Promise<void>((resolve, reject) => {
          const request = store.put(cachedProfile);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("Error caching profile:", error);
      }
    },
    [user]
  );

  const getCachedProfile = useCallback(async (): Promise<CachedProfile["data"] | null> => {
    if (!user) return null;

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.PROFILE, "readonly");
      const store = tx.objectStore(STORES.PROFILE);

      return new Promise((resolve, reject) => {
        const request = store.get(user.id);
        request.onsuccess = () => {
          const result = request.result as CachedProfile | undefined;
          resolve(result?.data || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached profile:", error);
      return null;
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════════════════
  // REGIES CACHE (for RGE Card offline)
  // ═══════════════════════════════════════════════════════════════════════════
  const cacheRegiesList = useCallback(
    async (regiesList: CachedRegie["data"][]) => {
      if (!user) return;

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORES.REGIES, "readwrite");
        const store = tx.objectStore(STORES.REGIES);

        // Clear old cache
        await new Promise<void>((resolve) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });

        // Add new entries
        const now = new Date().toISOString();
        for (const regie of regiesList) {
          const cachedRegie: CachedRegie = {
            id: regie.id,
            userId: user.id,
            data: regie,
            cachedAt: now,
          };
          store.put(cachedRegie);
        }
      } catch (error) {
        console.error("Error caching regies:", error);
      }
    },
    [user]
  );

  const getCachedRegiesList = useCallback(async (): Promise<CachedRegie["data"][]> => {
    if (!user) return [];

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORES.REGIES, "readonly");
      const store = tx.objectStore(STORES.REGIES);
      const index = store.index("userId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(user.id));
        request.onsuccess = () => {
          const results = request.result as CachedRegie[];
          resolve(results.map((r) => r.data));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting cached regies:", error);
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

      void etudeIndex;
      // Booleans are not valid IndexedDB keys: filter in JS instead of IDBKeyRange.only(false)
      const pendingEtudes: PendingEtude[] = await new Promise((resolve, reject) => {
        const request = etudeStore.getAll();
        request.onsuccess = () => resolve((request.result as PendingEtude[]).filter((e) => !e.synced));
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

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH CACHE (when coming online)
  // ═══════════════════════════════════════════════════════════════════════════
  const refreshCache = useCallback(async () => {
    if (!user || !isOnline) return;

    try {
      // Refresh RDVs (next 30 days)
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const { data: rdvs } = await supabase
        .from("rdv")
        .select(`
          id,
          date_heure,
          duree_minutes,
          adresse,
          status,
          type_projet,
          type_rdv,
          client_id,
          is_r2,
          r2_type,
          etude_id,
          latitude,
          longitude,
          regie_id,
          regies(id, nom, couleur),
          clients!inner(id, nom, prenom, telephone, adresse, code_postal, ville, latitude, longitude)
        `)
        .eq("user_id", user.id)
        .gte("date_heure", startDate.toISOString())
        .lte("date_heure", endDate.toISOString())
        .order("date_heure", { ascending: true });

      if (rdvs) {
        await cacheRdvList(rdvs);
        console.log(`[Offline] Cached ${rdvs.length} RDVs`);
      }

      // Refresh clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, nom, prenom, telephone, adresse, code_postal, ville, email, latitude, longitude")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (clients) {
        await cacheClientsList(clients);
        console.log(`[Offline] Cached ${clients.length} clients`);
      }

      // Refresh profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url, numero_agrement, telephone_pro, nom_scene, prenom_scene")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        await cacheProfile(profile);
        console.log("[Offline] Cached profile");
      }

      // Refresh regies
      const { data: regies } = await supabase
        .from("regies")
        .select("id, nom, siret, couleur, is_hejja")
        .eq("user_id", user.id)
        .eq("actif", true)
        .order("nom");

      if (regies) {
        await cacheRegiesList(regies.map(r => ({ ...r, is_hejja: r.is_hejja ?? false })));
        console.log(`[Offline] Cached ${regies.length} regies`);
      }

    } catch (error) {
      console.error("[Offline] Cache refresh error:", error);
    }
  }, [user, isOnline, cacheRdvList, cacheClientsList, cacheProfile, cacheRegiesList]);

  // Track if cache has been refreshed this session
  const hasRefreshedRef = useRef(false);
  
  // Manual refresh function exposed to consumers - does NOT auto-refresh on mount
  // Pages should call this explicitly after their initial data load is complete
  const triggerCacheRefresh = useCallback(async () => {
    if (isOnline && user && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      await refreshCache();
    }
  }, [isOnline, user, refreshCache]);
  
  // Reset when going offline so we can refresh again when back online
  useEffect(() => {
    if (!isOnline) {
      hasRefreshedRef.current = false;
    }
  }, [isOnline]);

  return {
    isOnline,
    isSyncing,
    pendingEtudesCount,
    pendingWhatsAppCount,
    saveEtudeOffline,
    getOfflineEtude,
    cacheRdvList,
    getCachedRdvList,
    cacheClientsList,
    getCachedClientsList,
    getCachedClient,
    cacheProfile,
    getCachedProfile,
    cacheRegiesList,
    getCachedRegiesList,
    queueWhatsAppMessage,
    syncAll,
    refreshCache,
    triggerCacheRefresh,
  };
}
