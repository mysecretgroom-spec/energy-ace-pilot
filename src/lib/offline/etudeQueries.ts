import { supabase } from "@/integrations/supabase/client";
import { cachedQuery } from "./network";

/**
 * Données de référence de l'outil d'étude (prix, gammes via bouquets, aides,
 * financements, surcoûts par régie). Mêmes fonctions au préchargement et à
 * l'usage → l'étude se calcule avec les paramètres de la régie même sans réseau.
 */
const sb = supabase as any;
const q = <T = any[]>(key: string, build: () => PromiseLike<{ data: T | null; error: unknown }>) => cachedQuery<T>(`etude_ref:${key}`, build);

export const etudeRef = {
  psh: () => q("data_psh", () => sb.from("data_psh").select("*").order("department_code")),
  orientation: () => q("data_orientation", () => sb.from("data_orientation").select("*")),
  tarifs: () => q("data_tarifs_revente", () => sb.from("data_tarifs_revente").select("*").eq("actif", true)),
  surcouts: () => q("data_surcouts", () => sb.from("data_surcouts").select("*").eq("actif", true)),
  calibres: () => q("data_calibres", () => sb.from("data_calibres").select("*").eq("actif", true).order("calibre_amperes")),
  compteurs: () => q("data_compteurs", () => sb.from("data_compteurs").select("*").eq("actif", true)),
  aides: () => q("data_aides", () => sb.from("data_aides").select("*").eq("actif", true)),
  evolution: () => q("data_evolution_prix_energie", () => sb.from("data_evolution_prix_energie").select("*").eq("actif", true)),
  bouquets: () => q("bouquets", () => sb.from("bouquets").select("id, nom_bouquet, puissance_kwc, prix_recommande, regie_ids, product_type, gamme").eq("actif", true).order("puissance_kwc")),
  regieFinancements: (regieId: string) => q(`regies_financements:${regieId}`, () => sb.from("regies_financements").select("id, nom, taux_effectif, taeg, actif, duree_mois, mode_calcul, duree_report_mois, frais_dossier_pct, calcul_auto").eq("regie_id", regieId).eq("actif", true).order("nom")),
  regieSurcouts: (regieId: string) => q(`regies_surcouts:${regieId}`, () => sb.from("regies_surcouts").select("id, code, nom, prix, categorie, type_calcul").eq("regie_id", regieId).eq("actif", true)),
  regieGammes: (regieId: string) => q(`regies_gammes:${regieId}`, () => sb.from("regies_gammes").select("*").eq("regie_id", regieId)),
  financements: () => q("data_financements", () => sb.from("data_financements").select("*").eq("actif", true).order("nom")),
  pacIsolation: () => q("data_pac_isolation", () => sb.from("data_pac_isolation").select("*").eq("actif", true).order("ordre")),
  pacCop: () => q("data_pac_cop", () => sb.from("data_pac_cop").select("*").eq("actif", true).order("temperature_exterieure")),
  pacPuissances: () => q("data_pac_puissances", () => sb.from("data_pac_puissances").select("*").eq("actif", true).order("surface_min")),
  energiesPrix: () => q("data_energies_prix", () => sb.from("data_energies_prix").select("*").eq("actif", true)),
  zones: () => q("data_zones_climatiques", () => sb.from("data_zones_climatiques").select("*").eq("actif", true)),
  aidesPac: () => q("data_aides_pac", () => sb.from("data_aides_pac").select("*").eq("actif", true)),
  iteMurs: () => q("data_ite_murs", () => sb.from("data_ite_murs").select("*").eq("actif", true)),
  iteIsolants: () => q("data_ite_isolants", () => sb.from("data_ite_isolants").select("*").eq("actif", true)),
  iteFinitions: () => q("data_ite_finitions", () => sb.from("data_ite_finitions").select("*").eq("actif", true)),
  iteEconomies: () => q("data_ite_economies", () => sb.from("data_ite_economies").select("*").eq("actif", true).order("gain_r_min")),
  aidesIte: () => q("data_aides_ite", () => sb.from("data_aides_ite").select("*").eq("actif", true)),
};

const GLOBAL_KEYS = Object.entries(etudeRef).filter(([, fn]) => fn.length === 0).map(([, fn]) => fn as () => Promise<unknown>);

/** Précharge les référentiels communs + les paramètres de chaque régie des RDV. */
export async function preloadEtudeReference(regieIds: string[]) {
  await Promise.allSettled(GLOBAL_KEYS.map((fn) => fn()));
  for (const id of new Set(regieIds)) {
    await Promise.allSettled([etudeRef.regieFinancements(id), etudeRef.regieSurcouts(id), etudeRef.regieGammes(id)]);
  }
}
