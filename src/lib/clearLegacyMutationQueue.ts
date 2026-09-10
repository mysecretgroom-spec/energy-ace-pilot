/**
 * Nettoyage unique de l'ancienne file d'attente globale de mutations hors-ligne.
 *
 * Cette file interceptait TOUTES les requêtes de l'app et renvoyait de fausses
 * réponses « 200 », ce qui laissait des actions bloquées « en attente ».
 * Le mode hors-ligne se limite désormais au planning (lecture) et à l'outil
 * d'étude (brouillons synchronisés). On vide donc l'ancien store.
 */

const DB_NAME = "debalepro_offline";
const LEGACY_STORE = "pending_mutations";
const FLAG_KEY = "__legacy_mutation_queue_cleared__";

export function clearLegacyMutationQueue() {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    if (localStorage.getItem(FLAG_KEY) === "1") return;
  } catch {
    /* localStorage indisponible : on tente quand même le nettoyage */
  }

  try {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (db.objectStoreNames.contains(LEGACY_STORE)) {
          const tx = db.transaction(LEGACY_STORE, "readwrite");
          tx.objectStore(LEGACY_STORE).clear();
          tx.oncomplete = () => db.close();
        } else {
          db.close();
        }
      } catch {
        try { db.close(); } catch { /* ignore */ }
      }
      try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("offline-queue-changed"));
    };
    request.onerror = () => { /* rien à nettoyer */ };
  } catch {
    /* ignore */
  }
}
