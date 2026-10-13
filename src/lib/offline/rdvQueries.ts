import { supabase } from "@/integrations/supabase/client";
import { cachedQuery } from "./network";

/**
 * Lectures nécessaires pour clôturer un RDV (statut, signature, WhatsApp).
 * Les mêmes fonctions servent au préchargement et à l'usage → mêmes clés de cache.
 */
export const qRegieContact = (regieId: string) =>
  cachedQuery(`regie_contact:${regieId}`, () => supabase.from("regies_contacts")
    .select("telephone").eq("regie_id", regieId).eq("is_principal", true).eq("actif", true).maybeSingle());

export const qNotifSettings = (userId: string) =>
  cachedQuery(`notif_settings:${userId}`, () => supabase.from("settings_notifications")
    .select("*").eq("user_id", userId).maybeSingle());

export const qTemplates = (userId: string) =>
  cachedQuery<{ classification: string; template_text: string }[]>(`templates:${userId}`, () => supabase.from("whatsapp_templates")
    .select("classification, template_text").eq("user_id", userId).eq("is_active", true) as any);

const RECAP_STUDY_FIELDS = "consommation_annuelle_kwh, facture_annuelle_euros, puissance_kwc, prix_total, mensualite_estimee, total_aides, prime_autoconsommation, eco_tva, adresse_installation, code_postal_installation, ville_installation, cq_date_heure, rdv_id";

export const qRecapStudy = (userId: string, etudeId?: string | null, rdvId?: string | null) => {
  if (!etudeId && !rdvId) return Promise.resolve({ data: null, error: null, fromCache: false });
  return cachedQuery<any>(`recap_study:${etudeId ? `e:${etudeId}` : `r:${rdvId}`}`, () => {
    let q = supabase.from("etudes").select(RECAP_STUDY_FIELDS).eq("user_id", userId);
    q = etudeId ? q.eq("id", etudeId) : q.eq("rdv_id", rdvId!);
    return q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  });
};

export const qRecapRdv = (userId: string, id: string) =>
  cachedQuery<any>(`recap_rdv:${id}`, () => supabase.from("rdv")
    .select("date_heure, adresse, commentaire, type_projet, duree_minutes, parent_rdv_id, clients(nom, prenom, telephone, adresse, code_postal, ville)")
    .eq("user_id", userId).eq("id", id).maybeSingle());

export const qRdvRow = (id: string) =>
  cachedQuery<any>(`rdv_row:${id}`, () => supabase.from("rdv")
    .select("id, parent_rdv_id, client_id, adresse, type_projet, duree_minutes, regie_id").eq("id", id).maybeSingle());

export const qRdvChildren = (id: string) =>
  cachedQuery<{ id: string }[]>(`rdv_children:${id}`, () => supabase.from("rdv")
    .select("id").eq("parent_rdv_id", id).neq("status", "annule") as any);

export const qSigneBouquets = () =>
  cachedQuery<any[]>(`signe_bouquets`, () => supabase.from("bouquets")
    .select("id, nom_bouquet, puissance_kwc, prix_recommande, commission_fixe, commission_pct, product_type, regie_ids")
    .eq("actif", true).order("puissance_kwc", { ascending: true }) as any);

export const qSigneSurcouts = (regieId: string) =>
  cachedQuery<any[]>(`signe_surcouts:${regieId}`, () => supabase.from("regies_surcouts")
    .select("id, nom, code, prix, categorie, type_calcul").eq("regie_id", regieId).eq("actif", true)
    .order("categorie", { ascending: true }) as any);

export const qSigneEtude = (etudeId: string) =>
  cachedQuery<any>(`signe_etude:${etudeId}`, () => supabase.from("etudes")
    .select("puissance_kwc, prix_total").eq("id", etudeId).maybeSingle());

export const qEtudeRegie = (etudeId: string) =>
  cachedQuery<any>(`etude_regie:${etudeId}`, () => supabase.from("etudes")
    .select("client_id, clients(regie_id)").eq("id", etudeId).maybeSingle());
