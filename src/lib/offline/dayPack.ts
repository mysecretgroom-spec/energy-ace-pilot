import { supabase } from "@/integrations/supabase/client";
import { SATELLITE_TILE_URL } from "@/lib/roofMapImage";
import { preloadEtudeReference } from "./etudeQueries";
import { kvGet, kvSet } from "./store";
import { isDeviceOffline } from "./network";
import {
  qEtudeRegie, qNotifSettings, qRdvChildren, qRdvRow, qRecapRdv, qRecapStudy,
  qRegieContact, qSigneBouquets, qSigneEtude, qSigneSurcouts, qTemplates,
} from "./rdvQueries";

export type PackRdv = {
  id: string;
  date_heure: string;
  duree_minutes: number | null;
  status: string;
  adresse: string | null;
  commentaire: string | null;
  latitude: number | null;
  longitude: number | null;
  regie_id: string | null;
  etude_id: string | null;
  client_id: string;
  type_projet: string | null;
  clients: { nom: string; prenom: string | null; telephone: string | null; telephone_secondaire: string | null; adresse: string | null; code_postal: string | null; ville: string | null } | null;
  regies: { nom: string } | null;
};

export type DayPack = { userId: string; at: number; rdvs: PackRdv[]; ready: string[] };

export const PACK_EVENT = "offline-day-pack-changed";
const packKey = (userId: string) => `day_pack:${userId}`;

export const getDayPack = (userId: string) => kvGet<DayPack>(packKey(userId));

/** Ordre de préchargement : RDV en cours puis suivant d'abord, puis le reste du jour et le lendemain. */
export function prioritizeRdvs<T extends { date_heure: string; duree_minutes: number | null }>(rdvs: T[], now = new Date()): T[] {
  const sorted = [...rdvs].sort((a, b) => a.date_heure.localeCompare(b.date_heure));
  const end = (r: T) => new Date(r.date_heure).getTime() + (r.duree_minutes || 90) * 60000;
  const idx = sorted.findIndex((r) => end(r) >= now.getTime());
  if (idx < 0) return sorted;
  return [...sorted.slice(idx), ...sorted.slice(0, idx)];
}

/** RDV imminent : en cours ou prochain à venir. */
export function imminentRdvs(pack: DayPack | undefined, now = new Date(), count = 2): PackRdv[] {
  if (!pack) return [];
  const t = now.getTime();
  return [...pack.rdvs]
    .filter((r) => r.status !== "annule" && new Date(r.date_heure).getTime() + (r.duree_minutes || 90) * 60000 >= t)
    .sort((a, b) => a.date_heure.localeCompare(b.date_heure))
    .slice(0, count);
}

function lonLatToTile(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Précharge les tuiles satellite autour du point (mises en cache par le service worker en production). */
async function prefetchTiles(lat: number, lon: number) {
  const urls: string[] = [];
  for (const z of [17, 18, 19]) {
    const { x, y } = lonLatToTile(lon, lat, z);
    const r = z === 19 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      urls.push(SATELLITE_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x + dx)).replace("{y}", String(y + dy)));
    }
  }
  await Promise.all(urls.map((u) => fetch(u, { mode: "no-cors" }).catch(() => null)));
}

let running: Promise<void> | null = null;

export function preloadDayPack(userId: string): Promise<void> {
  if (running || isDeviceOffline()) return running || Promise.resolve();
  running = (async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 2);
    const { data, error } = await supabase.from("rdv")
      .select("id, date_heure, duree_minutes, status, adresse, commentaire, latitude, longitude, regie_id, etude_id, client_id, type_projet, parent_rdv_id, clients(nom, prenom, telephone, telephone_secondaire, adresse, code_postal, ville), regies(nom)")
      .eq("user_id", userId).gte("date_heure", start.toISOString()).lt("date_heure", end.toISOString())
      .order("date_heure", { ascending: true });
    if (error || !data) return;

    const rdvs = prioritizeRdvs(data as unknown as PackRdv[]);
    const previous = await getDayPack(userId);
    // Les infos client essentielles sont enregistrées tout de suite.
    const pack: DayPack = { userId, at: Date.now(), rdvs, ready: previous?.ready.filter((id) => rdvs.some((r) => r.id === id)) || [] };
    await kvSet(packKey(userId), pack);
    window.dispatchEvent(new CustomEvent(PACK_EVENT));

    await Promise.allSettled([qNotifSettings(userId), qTemplates(userId), qSigneBouquets()]);
    // Paramètres régie (prix, gammes, aides, financements, surcoûts) avant tout RDV.
    await preloadEtudeReference(rdvs.map((r) => r.regie_id).filter((id): id is string => !!id));
    const ready = new Set<string>();
    for (const r of rdvs) {
      const tasks: Promise<unknown>[] = [
        qRecapStudy(userId, r.etude_id, r.etude_id ? null : r.id),
        qRecapRdv(userId, r.id), qRdvRow(r.id), qRdvChildren(r.id),
      ];
      const parent = (r as unknown as { parent_rdv_id?: string | null }).parent_rdv_id;
      if (parent) tasks.push(qRecapRdv(userId, parent), qRdvRow(parent));
      if (r.regie_id) tasks.push(qRegieContact(r.regie_id), qSigneSurcouts(r.regie_id));
      if (r.etude_id) tasks.push(qSigneEtude(r.etude_id), qEtudeRegie(r.etude_id));
      if (r.latitude && r.longitude) tasks.push(prefetchTiles(r.latitude, r.longitude));
      const results = await Promise.allSettled(tasks);
      if (results.every((x) => x.status === "fulfilled")) ready.add(r.id);
      pack.ready = [...ready];
      await kvSet(packKey(userId), pack);
      window.dispatchEvent(new CustomEvent(PACK_EVENT));
    }
  })().catch((e) => console.warn("[DayPack]", e)).finally(() => { running = null; });
  return running;
}
