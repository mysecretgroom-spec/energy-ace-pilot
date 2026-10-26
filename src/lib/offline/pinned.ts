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
export type Pin = { kind: PinKind; id: string; label: string; bytes: number; at: number; fileUrls: string[]; auto?: boolean };

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

export async function pinDocument(userId: string, doc: { id: string; nom: string; url: string }, auto = false) {
  const bytes = await cacheFile(doc.url);
  const pins = (await listPins(userId)).filter((p) => !(p.kind === "document" && p.id === doc.id));
  pins.push({ kind: "document", id: doc.id, label: doc.nom, bytes, at: Date.now(), fileUrls: [doc.url], auto });
  await savePins(userId, pins);
}

export async function pinEtude(userId: string, etude: { id: string; label: string }, auto = false) {
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
  pins.push({ kind: "etude", id: etude.id, label: etude.label, bytes, at: Date.now(), fileUrls, auto });
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

/** Semaine israélienne (dimanche → samedi) contenant `now`. */
export function israeliWeekRange(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay());
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { start, end };
}

let weekRunning: Promise<void> | null = null;
/**
 * Garde automatiquement hors ligne les études et documents clients des RDV de la semaine,
 * et retire celles gardées automatiquement qui n'en font plus partie.
 * Les choix manuels ne sont jamais retirés.
 */
export function syncWeekEtudes(userId: string): Promise<void> {
  if (weekRunning || (typeof navigator !== "undefined" && navigator.onLine === false)) return weekRunning || Promise.resolve();
  weekRunning = (async () => {
    const { start, end } = israeliWeekRange();
    const { data: rdvs, error } = await supabase.from("rdv")
      .select("id, etude_id, client_id, clients(nom, prenom)")
      .eq("user_id", userId).gte("date_heure", start.toISOString()).lt("date_heure", end.toISOString());
    if (error || !rdvs) return;
    const rdvIds = rdvs.map((r) => r.id);
    const { data: linked } = rdvIds.length
      ? await supabase.from("etudes").select("id, rdv_id").in("rdv_id", rdvIds)
      : { data: [] as { id: string; rdv_id: string | null }[] };
    const names = new Map(rdvs.map((r: any) => [r.id, [r.clients?.prenom, r.clients?.nom].filter(Boolean).join(" ") || "Client"]));
    const wanted = new Map<string, string>();
    for (const r of rdvs) if (r.etude_id) wanted.set(r.etude_id, names.get(r.id)!);
    for (const e of linked ?? []) wanted.set(e.id, names.get(e.rdv_id!) ?? "Client");

    const clientIds = [...new Set(rdvs.map((r) => r.client_id).filter(Boolean))] as string[];
    const { data: docs } = clientIds.length
      ? await supabase.from("documents").select("id, nom, url").in("client_id", clientIds).limit(300)
      : { data: [] as { id: string; nom: string; url: string }[] };
    const wantedDocs = new Map((docs ?? []).map((d) => [d.id, d]));

    const pins = await listPins(userId);
    for (const p of pins) {
      if (!p.auto) continue;
      if (p.kind === "etude" && !wanted.has(p.id)) await unpin(userId, "etude", p.id);
      if (p.kind === "document" && !wantedDocs.has(p.id)) await unpin(userId, "document", p.id);
    }
    for (const [id, d] of wantedDocs) {
      if (pins.some((p) => p.kind === "document" && p.id === id)) continue;
      try { await pinDocument(userId, d, true); } catch (e) { console.warn("[WeekDocs]", e); }
    }
    for (const [id, name] of wanted) {
      if (pins.some((p) => p.kind === "etude" && p.id === id)) continue;
      try { await pinEtude(userId, { id, label: `${name} — RDV de la semaine` }, true); } catch (e) { console.warn("[WeekEtudes]", e); }
    }
  })().catch((e) => console.warn("[WeekEtudes]", e)).finally(() => { weekRunning = null; });
  return weekRunning;
}
