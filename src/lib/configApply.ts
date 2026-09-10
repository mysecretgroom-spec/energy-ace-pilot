/**
 * Helpers partagés entre l'assistant de paramétrage « un domaine à la fois »
 * et l'assistant « modèle de régie » (plusieurs domaines en une seule dictée).
 *
 * Aucune écriture n'a lieu ici sans changement déjà validé côté appelant.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  ConfigChange,
  ConfigDomain,
  ConfigProposal,
  sanitizeChange,
} from "@/lib/configDomains";

export type ConfigRow = Record<string, unknown>;

export interface AssistantInput {
  texte?: string;
  audioBase64?: string;
  audioFormat?: string;
  fileDataUrl?: string;
  fileName?: string;
}

/** Colonnes de portée ajoutées à la création d'une ligne */
export function scopePayload(
  domain: ConfigDomain,
  userId: string,
  regieId: string | null
): ConfigRow {
  if (!domain.regieScoped) return { user_id: userId };
  if (domain.table === "bouquets") return { user_id: userId, regie_ids: regieId ? [regieId] : [] };
  return { user_id: userId, regie_id: regieId };
}

/** Charge les lignes existantes du domaine (filtrées par régie si besoin) */
export async function fetchDomainRows(
  domain: ConfigDomain,
  regieId: string | null
): Promise<ConfigRow[]> {
  let query = supabase.from(domain.table as never).select("*");
  if (domain.regieScoped && regieId) {
    query =
      domain.table === "bouquets"
        ? (query as never as { contains: (c: string, v: unknown) => typeof query }).contains(
            "regie_ids",
            [regieId]
          )
        : (query as never as { eq: (c: string, v: unknown) => typeof query }).eq("regie_id", regieId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as ConfigRow[]) || [];
}

/** Réduit les lignes aux seules colonnes pilotables (contexte envoyé à l'IA) */
export function slimRows(domain: ConfigDomain, rows: ConfigRow[]): ConfigRow[] {
  return rows.map((r) => {
    const slim: ConfigRow = { id: r.id };
    for (const f of domain.fields) slim[f.name] = r[f.name] ?? null;
    if (domain.hasGlobalRows) slim.global = r.user_id === null;
    return slim;
  });
}

export interface DomainProposalResult {
  proposal: ConfigProposal;
  rejected: string[];
}

/** Demande une proposition à l'IA pour un domaine (aucune écriture) */
export async function askDomain(
  domain: ConfigDomain,
  rows: ConfigRow[],
  input: AssistantInput,
  consigne?: string
): Promise<DomainProposalResult> {
  const { data, error } = await supabase.functions.invoke("config-assistant", {
    body: {
      domaineLabel: domain.label,
      domaineDescription: consigne ? `${domain.description}\n\n${consigne}` : domain.description,
      fields: domain.fields,
      rows: slimRows(domain, rows),
      ...input,
    },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

  const raw = data as ConfigProposal;
  const accepted: ConfigChange[] = [];
  const rejected: string[] = [];

  for (const change of raw.changements || []) {
    const target = change.id ? rows.find((r) => r.id === change.id) : null;
    if (target && domain.hasGlobalRows && target.user_id === null) {
      rejected.push(`« ${change.cible || "ligne partagée"} » : donnée globale non modifiable`);
      continue;
    }
    const { change: clean, erreur } = sanitizeChange(domain, change);
    if (erreur || !clean) {
      rejected.push(`« ${change.cible || change.action} » : ${erreur}`);
      continue;
    }
    accepted.push(clean);
  }

  return {
    proposal: {
      resume: raw.resume || "",
      raisonnement: raw.raisonnement || "",
      changements: accepted,
    },
    rejected,
  };
}

export interface ApplyResult {
  createdIds: string[];
  snapshot: ConfigRow[];
}

/** Applique les changements validés d'un domaine et renvoie de quoi les annuler */
export async function applyDomainChanges(
  domain: ConfigDomain,
  userId: string,
  regieId: string | null,
  changes: ConfigChange[],
  rows: ConfigRow[]
): Promise<ApplyResult> {
  const touchedIds = changes.map((c) => c.id).filter(Boolean) as string[];
  const snapshot = rows.filter((r) => touchedIds.includes(String(r.id)));
  const createdIds: string[] = [];

  for (const change of changes) {
    if (change.action === "creer") {
      const { data, error } = await supabase
        .from(domain.table as never)
        .insert({ ...change.valeurs, ...scopePayload(domain, userId, regieId) } as never)
        .select("id")
        .single();
      if (error) throw error;
      const created = data as { id?: string } | null;
      if (created?.id) createdIds.push(created.id);
    } else if (change.action === "modifier") {
      const { error } = await supabase
        .from(domain.table as never)
        .update(change.valeurs as never)
        .eq("id", change.id as string);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(domain.table as never)
        .delete()
        .eq("id", change.id as string);
      if (error) throw error;
    }
  }

  return { createdIds, snapshot };
}

/** Restaure l'état d'un domaine à partir d'un point de sauvegarde */
export async function restoreDomain(
  domain: ConfigDomain,
  createdIds: string[],
  snapshot: ConfigRow[]
): Promise<void> {
  if (createdIds.length > 0) {
    await supabase.from(domain.table as never).delete().in("id", createdIds);
  }
  for (const row of snapshot) {
    const exists = await supabase
      .from(domain.table as never)
      .select("id")
      .eq("id", row.id as string)
      .maybeSingle();
    if (exists.data) {
      await supabase
        .from(domain.table as never)
        .update(row as never)
        .eq("id", row.id as string);
    } else {
      await supabase.from(domain.table as never).insert(row as never);
    }
  }
}
