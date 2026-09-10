import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ConfigChange,
  ConfigDomain,
  ConfigProposal,
  sanitizeChange,
} from "@/lib/configDomains";

type Row = Record<string, unknown>;

export interface ConfigHistoryEntry {
  id: string;
  domaine: string;
  regie_id: string | null;
  resume: string | null;
  raisonnement: string | null;
  source_prompt: string | null;
  snapshot_avant: Row[];
  changements: ConfigChange[];
  statut: string;
  created_at: string;
}

/** Colonnes de portée ajoutées à la création d'une ligne */
function scopePayload(domain: ConfigDomain, userId: string, regieId: string | null): Row {
  if (!domain.regieScoped) return { user_id: userId };
  if (domain.table === "bouquets") return { user_id: userId, regie_ids: regieId ? [regieId] : [] };
  return { user_id: userId, regie_id: regieId };
}

export function useConfigAssistant(domain: ConfigDomain | undefined, regieId: string | null) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState<ConfigProposal | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);

  const fetchRows = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    try {
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
      setRows((data as Row[]) || []);
    } finally {
      setLoading(false);
    }
  }, [domain, regieId]);

  const fetchHistory = useCallback(async () => {
    if (!domain || !user) return;
    const { data } = await supabase
      .from("config_ai_changes")
      .select("*")
      .eq("domaine", domain.key)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(((data as unknown as ConfigHistoryEntry[]) || []).map((h) => ({
      ...h,
      snapshot_avant: (h.snapshot_avant as unknown as Row[]) || [],
      changements: (h.changements as unknown as ConfigChange[]) || [],
    })));
  }, [domain, user]);

  /** Demande une proposition à l'IA (aucune écriture en base) */
  const ask = useCallback(
    async (input: { texte?: string; audioBase64?: string; audioFormat?: string; fileDataUrl?: string; fileName?: string }) => {
      if (!domain) return;
      setAsking(true);
      setProposal(null);
      setRejected([]);
      try {
        const context = rows.map((r) => {
          const slim: Row = { id: r.id };
          for (const f of domain.fields) slim[f.name] = r[f.name] ?? null;
          if (domain.hasGlobalRows) slim.global = r.user_id === null;
          return slim;
        });

        const { data, error } = await supabase.functions.invoke("config-assistant", {
          body: {
            domaineLabel: domain.label,
            domaineDescription: domain.description,
            fields: domain.fields,
            rows: context,
            ...input,
          },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

        const raw = data as ConfigProposal;
        const accepted: ConfigChange[] = [];
        const refused: string[] = [];

        for (const change of raw.changements || []) {
          const target = change.id ? rows.find((r) => r.id === change.id) : null;
          if (target && domain.hasGlobalRows && target.user_id === null) {
            refused.push(`« ${change.cible || "ligne partagée"} » : donnée globale non modifiable`);
            continue;
          }
          const { change: clean, erreur } = sanitizeChange(domain, change);
          if (erreur || !clean) {
            refused.push(`« ${change.cible || change.action} » : ${erreur}`);
            continue;
          }
          accepted.push(clean);
        }

        setProposal({
          resume: raw.resume || "",
          raisonnement: raw.raisonnement || "",
          changements: accepted,
        });
        setRejected(refused);
      } finally {
        setAsking(false);
      }
    },
    [domain, rows]
  );

  /** Applique la proposition et enregistre un point de restauration */
  const apply = useCallback(
    async (sourcePrompt: string) => {
      if (!domain || !user || !proposal || proposal.changements.length === 0) return;
      setApplying(true);
      try {
        const touchedIds = proposal.changements.map((c) => c.id).filter(Boolean) as string[];
        const snapshot = rows.filter((r) => touchedIds.includes(String(r.id)));
        const createdIds: string[] = [];

        for (const change of proposal.changements) {
          if (change.action === "creer") {
            const { data, error } = await supabase
              .from(domain.table as never)
              .insert({ ...change.valeurs, ...scopePayload(domain, user.id, regieId) } as never)
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

        await supabase.from("config_ai_changes").insert({
          user_id: user.id,
          domaine: domain.key,
          regie_id: regieId,
          resume: proposal.resume,
          raisonnement: proposal.raisonnement,
          source_prompt: sourcePrompt.slice(0, 4000),
          snapshot_avant: snapshot as never,
          changements: [
            ...proposal.changements,
            ...createdIds.map((id) => ({ action: "creer" as const, id, valeurs: {} })),
          ] as never,
          statut: "applique",
        });

        setProposal(null);
        setRejected([]);
        await fetchRows();
        await fetchHistory();
      } finally {
        setApplying(false);
      }
    },
    [domain, user, proposal, rows, regieId, fetchRows, fetchHistory]
  );

  /** Annule une modification déjà appliquée : restaure l'état précédent */
  const rollback = useCallback(
    async (entry: ConfigHistoryEntry) => {
      if (!domain) return;
      const createdIds = entry.changements
        .filter((c) => c.action === "creer" && c.id)
        .map((c) => c.id as string);

      if (createdIds.length > 0) {
        await supabase.from(domain.table as never).delete().in("id", createdIds);
      }

      for (const row of entry.snapshot_avant) {
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

      await supabase.from("config_ai_changes").update({ statut: "annule" }).eq("id", entry.id);
      await fetchRows();
      await fetchHistory();
    },
    [domain, fetchRows, fetchHistory]
  );

  return {
    rows,
    loading,
    asking,
    applying,
    proposal,
    rejected,
    history,
    fetchRows,
    fetchHistory,
    ask,
    apply,
    rollback,
    discard: () => {
      setProposal(null);
      setRejected([]);
    },
  };
}
