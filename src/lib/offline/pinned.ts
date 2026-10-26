/**
 * Éléments choisis par l'utilisateur pour rester disponibles hors ligne
 * (documents et études). Les fichiers sont gardés en Blob dans IndexedDB ;
 * les études réutilisent la clé cachedQuery lue par l'écran d'étude.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolvePreviewUrl } from "@/components/documents/previewMedia";
import { kvGet, kvSet } from "./store";
import { cachedQuery } from "./network";

export type PinKind = "document" | "etude";
export type Pin = { kind: PinKind; id: string; label: string; bytes: number; at: number; fileUrls: string[] };

export const PINS_EVENT = "offline-pins-changed";
const pinsKey = (userId: string) => `pins:${userId}`;
const fileKey = (url: string) => `file:${url.split("?")[0]}`;

export const etudeQueryKey = (id: string) => `etude:${id}`;
export const qEtudeFull = (id: string) =>
  supabase.from("etudes").select("*").eq("id", id).maybeSingle();

export async function listPins(userId: string): Promise<Pin[]> {
  return (await kvGet<Pin[]>(pinsKey(userId))) ?? [];
}

async function savePins(userId: string, pins: Pin[]) {
  await kvSet(pinsKey(userId), pins);
  window.dispatchEvent(new Event(PINS_EVENT));
}

async function cacheFile(url: string): Promise<number> {
  const res = await fetch(await resolvePreviewUrl(url));
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const blob = await res.blob();
  await kvSet(fileKey(url), blob);
  return blob.size;
}

/** Fichier gardé hors ligne pour cette URL, s'il existe. */
export async function getPinnedFile(url: string): Promise<Blob | undefined> {
  const v = await kvGet<Blob>(fileKey(url));
  return v instanceof Blob ? v : undefined;
}

export async function pinDocument(userId: string, doc: { id: string; nom: string; url: string }) {
  const bytes = await cacheFile(doc.url);
  const pins = (await listPins(userId)).filter((p) => !(p.kind === "document" && p.id === doc.id));
  pins.push({ kind: "document", id: doc.id, label: doc.nom, bytes, at: Date.now(), fileUrls: [doc.url] });
  await savePins(userId, pins);
}

export async function pinEtude(userId: string, etude: { id: string; label: string }) {
  const res = await cachedQuery(etudeQueryKey(etude.id), () => qEtudeFull(etude.id), 15000);
  if (res.fromCache || !res.data) throw new Error("Connexion nécessaire pour enregistrer l'étude");
  const fileUrls: string[] = [];
  let bytes = JSON.stringify(res.data).length;
  const pdf = (res.data as { pdf_url?: string | null }).pdf_url;
  if (pdf) { bytes += await cacheFile(pdf); fileUrls.push(pdf); }
  const { data: docs } = await supabase.from("documents").select("url").eq("etude_id", etude.id).limit(60);
  for (const d of docs ?? []) {
    try { bytes += await cacheFile(d.url); fileUrls.push(d.url); } catch { /* fichier manquant : on continue */ }
  }
  const pins = (await listPins(userId)).filter((p) => !(p.kind === "etude" && p.id === etude.id));
  pins.push({ kind: "etude", id: etude.id, label: etude.label, bytes, at: Date.now(), fileUrls });
  await savePins(userId, pins);
}

export async function unpin(userId: string, kind: PinKind, id: string) {
  const pins = await listPins(userId);
  const target = pins.find((p) => p.kind === kind && p.id === id);
  const rest = pins.filter((p) => p !== target);
  const stillUsed = new Set(rest.flatMap((p) => p.fileUrls.map((u) => u.split("?")[0])));
  for (const u of target?.fileUrls ?? []) if (!stillUsed.has(u.split("?")[0])) await kvSet(fileKey(u), null);
  await savePins(userId, rest);
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
