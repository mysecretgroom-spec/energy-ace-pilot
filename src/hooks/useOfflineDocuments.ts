import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const DB_NAME = "debalepro_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_documents";

export interface PendingDocument {
  id: string;
  userId: string;
  clientId: string;
  nom: string;
  typeDocument: "photo_chantier" | "facture_frais" | "autre";
  imageData: string; // Base64 data
  mimeType: string;
  contextSource?: string;
  extractedText?: string;
  createdAt: string;
  retryCount: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Safety check for IndexedDB availability
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("clientId", "clientId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}

export function useOfflineDocuments() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();
  const { toast } = useToast();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
          const fileName = `${doc.clientId}/${doc.contextSource || "doc"}_${timestamp}.${extension}`;

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
