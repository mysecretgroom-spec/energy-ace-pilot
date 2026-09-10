import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ConfigChange, ConfigDomain, getConfigDomain } from "@/lib/configDomains";
import {
  AssistantInput,
  ConfigRow,
  applyDomainChanges,
  askDomain,
  fetchDomainRows,
  restoreDomain,
} from "@/lib/configApply";

/**
 * « Modèle de régie » : une seule dictée décrit les règles, les grilles de prix,
 * les surcoûts, les financements et les aides. Chaque domaine est traité
 * séparément par l'IA, puis l'ensemble est prévisualisé avant écriture.
 */
export const REGIE_MODEL_DOMAINS = [
  "regie_gammes",
  "regie_bouquets",
  "regie_surcouts",
  "regie_financements",
  "aides_pv",
] as const;

const CONSIGNE = `Cette demande décrit un MODÈLE DE RÉGIE complet (règles commerciales, gammes, grilles de prix,
surcoûts, financements et aides). Ne retiens QUE la partie de la demande qui concerne le domaine ci-dessus.
Si la demande ne dit rien sur ce domaine, renvoie une liste de changements VIDE.`;

export interface DomainProposalBlock {
  domain: ConfigDomain;
  rows: ConfigRow[];
  resume: string;
  raisonnement: string;
  changements: ConfigChange[];
  rejected: string[];
}

export interface ModelHistoryEntry {
  id: string;
  domaine: string;
  resume: string | null;
  source_prompt: string | null;
  snapshot_avant: ConfigRow[];
  changements: ConfigChange[];
  statut: string;
  created_at: string;
}

export function useRegieModel(regieId: string | null) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<DomainProposalBlock[]>([]);
  const [asking, setAsking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState<ModelHistoryEntry[]>([]);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from("config_ai_changes")
      .select("*")
      .in("domaine", REGIE_MODEL_DOMAINS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory(
      ((data as unknown as ModelHistoryEntry[]) || []).map((h) => ({
        ...h,
        snapshot_avant: (h.snapshot_avant as unknown as ConfigRow[]) || [],
        changements: (h.changements as unknown as ConfigChange[]) || [],
      }))
    );
  }, []);

  /** Interroge l'IA domaine par domaine (aucune écriture en base) */
  const ask = useCallback(
    async (input: AssistantInput) => {
      setAsking(true);
      setBlocks([]);
      try {
        const result: DomainProposalBlock[] = [];
        for (const key of REGIE_MODEL_DOMAINS) {
          const domain = getConfigDomain(key);
          if (!domain) continue;
          setProgress(domain.label);
          const rows = await fetchDomainRows(domain, regieId);
          const { proposal, rejected } = await askDomain(domain, rows, input, CONSIGNE);
          if (proposal.changements.length === 0 && rejected.length === 0) continue;
          result.push({
            domain,
            rows,
            resume: proposal.resume,
            raisonnement: proposal.raisonnement,
            changements: proposal.changements,
            rejected,
          });
        }
        setBlocks(result);
      } finally {
        setProgress(null);
        setAsking(false);
      }
    },
    [regieId]
  );

  /** Applique le modèle complet, un point de restauration par domaine */
  const apply = useCallback(
    async (sourcePrompt: string) => {
      if (!user) return;
      setApplying(true);
      try {
        for (const block of blocks) {
          if (block.changements.length === 0) continue;
          const { createdIds, snapshot } = await applyDomainChanges(
            block.domain,
            user.id,
            block.domain.regieScoped ? regieId : null,
            block.changements,
            block.rows
          );
          await supabase.from("config_ai_changes").insert({
            user_id: user.id,
            domaine: block.domain.key,
            regie_id: block.domain.regieScoped ? regieId : null,
            resume: block.resume || `Modèle de régie — ${block.domain.label}`,
            raisonnement: block.raisonnement,
            source_prompt: sourcePrompt.slice(0, 4000),
            snapshot_avant: snapshot as never,
            changements: [
              ...block.changements,
              ...createdIds.map((id) => ({ action: "creer" as const, id, valeurs: {} })),
            ] as never,
            statut: "applique",
          });
        }
        setBlocks([]);
        await fetchHistory();
      } finally {
        setApplying(false);
      }
    },
    [blocks, user, regieId, fetchHistory]
  );

  const rollback = useCallback(
    async (entry: ModelHistoryEntry) => {
      const domain = getConfigDomain(entry.domaine);
      if (!domain) return;
      const createdIds = entry.changements
        .filter((c) => c.action === "creer" && c.id)
        .map((c) => c.id as string);
      await restoreDomain(domain, createdIds, entry.snapshot_avant);
      await supabase.from("config_ai_changes").update({ statut: "annule" }).eq("id", entry.id);
      await fetchHistory();
    },
    [fetchHistory]
  );

  const totalChanges = blocks.reduce((n, b) => n + b.changements.length, 0);

  return {
    blocks,
    asking,
    progress,
    applying,
    history,
    totalChanges,
    ask,
    apply,
    rollback,
    fetchHistory,
    discard: () => setBlocks([]),
  };
}
