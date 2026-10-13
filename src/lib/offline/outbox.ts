import { supabase } from "@/integrations/supabase/client";
import { OUTBOX_STORE, storeDelete, storeGetAll, storePut } from "./store";
import { isDeviceOffline, isNetworkError } from "./network";

/**
 * File d'écritures hors-ligne, rejouée dans l'ordre au retour du réseau.
 * Les insertions portent un id généré sur le téléphone → rejouer deux fois
 * ne crée jamais de doublon (upsert sur id).
 */
export type OutboxOp = {
  id: string;
  seq: number;
  table: "rdv" | "ventes" | "etudes";
  op: "update" | "insert";
  values: Record<string, unknown>;
  /** Filtres d'égalité (valeur null → IS NULL). */
  match?: Record<string, string | null>;
  createdAt: string;
  error?: string;
};

export const OUTBOX_EVENT = "offline-outbox-changed";
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OUTBOX_EVENT)); };

let seqCounter = 0;
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export async function listOutbox(): Promise<OutboxOp[]> {
  const ops = await storeGetAll<OutboxOp>(OUTBOX_STORE);
  return ops.sort((a, b) => a.seq - b.seq);
}

export async function enqueue(op: Omit<OutboxOp, "id" | "seq" | "createdAt">): Promise<void> {
  const entry: OutboxOp = { ...op, id: newId(), seq: Date.now() * 1000 + (seqCounter++ % 1000), createdAt: new Date().toISOString() };
  await storePut(OUTBOX_STORE, entry);
  notify();
}

async function execute(op: Pick<OutboxOp, "table" | "op" | "values" | "match">) {
  const table = supabase.from(op.table) as any;
  if (op.op === "insert") {
    return table.upsert(op.values, { onConflict: "id", ignoreDuplicates: true });
  }
  let q = table.update(op.values);
  for (const [k, v] of Object.entries(op.match || {})) q = v === null ? q.is(k, null) : q.eq(k, v);
  return q;
}

/** Écrit tout de suite si possible, sinon met en file. Renvoie queued=true si différé. */
export async function writeOrQueue(op: Pick<OutboxOp, "table" | "op" | "values" | "match">): Promise<{ queued: boolean }> {
  if (op.op === "insert" && !op.values.id) op = { ...op, values: { ...op.values, id: newId() } };
  if (!isDeviceOffline()) {
    try {
      const { error } = await execute(op);
      if (!error) return { queued: false };
      if (!isNetworkError(error)) throw error;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  await enqueue(op);
  return { queued: true };
}

let flushing: Promise<number> | null = null;

/** Rejoue la file. S'arrête à la première coupure réseau pour garder l'ordre. */
export function flushOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let done = 0;
    for (const op of await listOutbox()) {
      if (isDeviceOffline()) break;
      try {
        const { error } = await execute(op);
        if (error) {
          if (isNetworkError(error)) break;
          await storePut(OUTBOX_STORE, { ...op, error: (error as { message?: string }).message || "Erreur" });
          continue;
        }
        await storeDelete(OUTBOX_STORE, op.id);
        done++;
      } catch (err) {
        if (isNetworkError(err)) break;
        await storePut(OUTBOX_STORE, { ...op, error: String(err) });
      }
    }
    notify();
    return done;
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Modifications RDV en attente, à superposer aux données en cache. */
export async function pendingRdvPatches(): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const op of await listOutbox()) {
    if (op.table !== "rdv" || op.op !== "update" || !op.match?.id) continue;
    map.set(op.match.id, { ...(map.get(op.match.id) || {}), ...op.values, __pending: true });
  }
  return map;
}
