import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { PLANS } from "@/lib/plans";

const EUR_TO_USD = 1.087; // budget mensuel selon l'offre (Classique 10 €, Premium 15 €)

export interface AIUsageBreakdown {
  function_name: string;
  tokens: number;
}

export interface AIUsageSummary {
  used_tokens: number;
  input_tokens: number;
  output_tokens: number;
  budget_tokens: number; // estimation tokens correspondant au budget mensuel
  warning_tokens: number; // seuil 80%
  soft_cap_tokens: number; // seuil 100%
  hard_cap_tokens: number; // seuil 150%
  ratio: number; // 0..1+ (basé sur le coût USD interne)
  status: "ok" | "warning" | "soft_capped" | "hard_capped";
  breakdown: AIUsageBreakdown[];
  reset_date: Date;
}

function getMonthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return `${n}`;
}

export function useAIUsage() {
  const { user } = useAuth();
  const { plan } = useSaasAccess();
  const MONTHLY_BUDGET_USD = PLANS[plan ?? "classique"].aiBudgetEur * EUR_TO_USD;

  return useQuery({
    queryKey: ["ai-usage", user?.id, getMonthKey(), plan],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // 5 min
    queryFn: async (): Promise<AIUsageSummary> => {
      if (!user) throw new Error("not authenticated");

      const { data, error } = await supabase
        .from("ai_usage")
        .select("function_name, estimated_cost_usd, input_tokens, output_tokens")
        .eq("user_id", user.id)
        .eq("month_key", getMonthKey());

      if (error) throw error;

      let usedUsd = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const byFn = new Map<string, number>();

      for (const row of data || []) {
        const r = row as any;
        const cost = Number(r.estimated_cost_usd || 0);
        const inT = Number(r.input_tokens || 0);
        const outT = Number(r.output_tokens || 0);
        usedUsd += cost;
        inputTokens += inT;
        outputTokens += outT;
        byFn.set(r.function_name, (byFn.get(r.function_name) || 0) + inT + outT);
      }

      const ratio = usedUsd / MONTHLY_BUDGET_USD;
      let status: AIUsageSummary["status"] = "ok";
      if (ratio >= 1.5) status = "hard_capped";
      else if (ratio >= 1.0) status = "soft_capped";
      else if (ratio >= 0.8) status = "warning";

      const totalTokens = inputTokens + outputTokens;
      // Estimation du budget en tokens à partir de la conso actuelle
      // (rapport tokens/coût observé). Fallback heuristique si pas de données.
      const tokensPerUsd = usedUsd > 0 ? totalTokens / usedUsd : 200_000;
      const budgetTokens = Math.round(tokensPerUsd * MONTHLY_BUDGET_USD);

      const breakdown = Array.from(byFn.entries())
        .map(([function_name, tokens]) => ({ function_name, tokens }))
        .sort((a, b) => b.tokens - a.tokens);

      return {
        used_tokens: totalTokens,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        budget_tokens: budgetTokens,
        warning_tokens: Math.round(budgetTokens * 0.8),
        soft_cap_tokens: budgetTokens,
        hard_cap_tokens: Math.round(budgetTokens * 1.5),
        ratio,
        status,
        breakdown,
        reset_date: getNextMonthDate(),
      };
    },
  });
}

const FUNCTION_LABELS: Record<string, string> = {
  "whatsapp-agent": "Agent IA",
  "smart-analyze": "Analyse documents",
  "analyze-document": "OCR documents",
  "workflow-assistant": "Workflows",
  "extract-bouquets": "Import régie",
  "extract-surcouts": "Import régie",
  "extract-regie-config": "Import régie",
  "ocr-receipt": "OCR factures",
  "classify-image-intent": "Classification photos",
  "ai-crop-detect": "Recadrage IA",
  "enhance-document-image": "Amélioration scan",
  "extract-rdv-from-image": "Extraction RDV",
  "import-rdv-email": "Import RDV email",
  "sync-gmail-rdv": "Synchro Gmail",
  "process-background-jobs": "Tâches de fond",
};

export function getFunctionLabel(name: string): string {
  return FUNCTION_LABELS[name] || name;
}
