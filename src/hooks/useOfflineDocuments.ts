import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";

const DB_NAME = "debalepro_offline";
const DB_VERSION = 3;
const STORE_NAME = "pending_documents";

export interface PendingDocument {
  id: string;
  userId: string;
  clientId: string;
  nom: string;
  typeDocument: "photo_chantier" | "photo_toiture" | "photo_compteur" | "photo_tableau" | "facture_frais" | "autre";
  imageData: string; // Base64 data
  mimeType: string;
  contextSource?: string;
  extractedText?: string;
  etudeId?: string | null;
  createdAt: string;
  retryCount: number;
}

const isSameKeyPath = (
  actual: string | string[] | null,
  expected: string | string[]
): boolean => {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.length === actual.length && expected.every((key, idx) => key === actual[idx]);
  }
  return actual === expected;
};

function createAllSharedStores(db: IDBDatabase) {
  // IMPORTANT: This DB is shared with offlineMutationQueue.
  // ALL stores must be created here to avoid missing-store errors from race conditions.
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("userId", "userId", { unique: false });
    store.createIndex("clientId", "clientId", { unique: false });
    store.createIndex("createdAt", "createdAt", { unique: false });
  }
  if (!db.objectStoreNames.contains("pending_mutations")) {
    const mutStore = db.createObjectStore("pending_mutations", { keyPath: "id" });
    mutStore.createIndex("createdAt", "createdAt", { unique: false });
    mutStore.createIndex("status", "status", { unique: false });
  }
}

function hasValidDocumentsSchema(db: IDBDatabase): boolean {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    return false;
  }

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  if (!isSameKeyPath(store.keyPath, "id")) {
    return false;
  }

  const requiredIndexes: Array<[string, string]> = [
    ["userId", "userId"],
    ["clientId", "clientId"],
    ["createdAt", "createdAt"],
  ];

  return requiredIndexes.every(([indexName, keyPath]) => {
    if (!store.indexNames.contains(indexName)) return false;
    return isSameKeyPath(store.index(indexName).keyPath, keyPath);
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
    request.onupgradeneeded = (event) => createAllSharedStores((event.target as IDBOpenDBRequest).result);
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

      if (hasValidDocumentsSchema(db)) {
        return db;
      }

      db.close();
      if (hasRecovered) {
        throw new Error("IndexedDB documents schema invalid after recovery");
      }

      console.warn("[OfflineDocuments] Invalid IndexedDB schema detected, recreating database...");
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

      console.warn(`[OfflineDocuments] ${errorName} detected, recreating database...`);
      await deleteOfflineDatabase();
      hasRecovered = true;
    }
  }
}

export function useOfflineDocuments() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  // État de connexion confirmé (partagé, anti faux "hors ligne")
  const { isOnline } = useConnectionQuality();
  const { user } = useAuth();
  const { toast } = useToast();

  // Load pending count on mount
  useEffect(() => {
    if (user) {
      loadPendingCount();
    }
  }, [user]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncPendingDocuments();
    }
  }, [isOnline, pendingCount]);

  const loadPendingCount = async () => {
    if (!user) return;

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("userId");
      const request = index.count(IDBKeyRange.only(user.id));

      request.onsuccess = () => {
        setPendingCount(request.result);
      };
    } catch (error) {
      console.error("Error loading pending count:", error);
    }
  };

  const savePendingDocument = useCallback(
    async (doc: Omit<PendingDocument, "id" | "userId" | "createdAt" | "retryCount">) => {
      if (!user) throw new Error("User not authenticated");

      const pendingDoc: PendingDocument = {
        ...doc,
        id: crypto.randomUUID(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        await new Promise<void>((resolve, reject) => {
          const request = store.add(pendingDoc);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        setPendingCount((prev) => prev + 1);

        toast({
          title: "Document enregistré hors-ligne",
          description: "Il sera synchronisé automatiquement",
        });

        return pendingDoc.id;
      } catch (error) {
        console.error("Error saving pending document:", error);
        throw error;
      }
    },
    [user, toast]
  );

  const getPendingDocuments = useCallback(async (): Promise<PendingDocument[]> => {
    if (!user) return [];

    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("userId");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(user.id));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting pending documents:", error);
      return [];
    }
  }, [user]);

  const deletePendingDocument = async (id: string) => {
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error deleting pending document:", error);
    }
  };

  const syncPendingDocuments = useCallback(async () => {
    if (!user || !isOnline || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const pendingDocs = await getPendingDocuments();

      for (const doc of pendingDocs) {
        try {
          // Convert base64 to blob
          const response = await fetch(doc.imageData);
          const blob = await response.blob();

          // Generate filename
          const timestamp = Date.now();
          const extension = doc.mimeType.split("/")[1] || "jpg";
          // Path MUST start with user_id to satisfy RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
          const fileName = `${doc.userId}/${doc.clientId}/${doc.contextSource || "doc"}_${timestamp}.${extension}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(fileName, blob, {
              contentType: doc.mimeType,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("documents")
            .getPublicUrl(fileName);

          // Save to database
          const { error: dbError } = await supabase.from("documents").insert({
            user_id: doc.userId,
            client_id: doc.clientId,
            nom: doc.nom,
            type_document: doc.typeDocument,
            url: urlData.publicUrl,
            mime_type: doc.mimeType,
            context_source: doc.contextSource,
            extracted_text: doc.extractedText,
            etude_id: doc.etudeId || null,
          });

          if (dbError) throw dbError;

          // Delete from IndexedDB
          await deletePendingDocument(doc.id);
          successCount++;
        } catch (error) {
          console.error("Error syncing document:", doc.id, error);
          failCount++;

          // Update retry count
          try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const updatedDoc = { ...doc, retryCount: doc.retryCount + 1 };
            store.put(updatedDoc);
          } catch (e) {
            console.error("Error updating retry count:", e);
          }
        }
      }

      if (successCount > 0) {
        toast({
          title: "Synchronisation terminée",
          description: `${successCount} document(s) synchronisé(s)`,
        });
      }

      if (failCount > 0) {
        toast({
          variant: "destructive",
          title: "Erreurs de synchronisation",
          description: `${failCount} document(s) non synchronisé(s)`,
        });
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
      await loadPendingCount();
    }
  }, [user, isOnline, isSyncing, getPendingDocuments, toast]);

  return {
    pendingCount,
    isSyncing,
    isOnline,
    savePendingDocument,
    getPendingDocuments,
    syncPendingDocuments,
    deletePendingDocument,
  };
}
