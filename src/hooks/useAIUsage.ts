import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MONTHLY_BUDGET_USD = 10.87; // ~10 EUR
const EUR_USD = 0.92;

export interface AIUsageBreakdown {
  function_name: string;
  cost_eur: number;
}

export interface AIUsageSummary {
  used_eur: number;
  budget_eur: number;
  ratio: number; // 0..1+
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

export function useAIUsage() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ai-usage", user?.id, getMonthKey()],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // 5 min
    queryFn: async (): Promise<AIUsageSummary> => {
      if (!user) throw new Error("not authenticated");

      const { data, error } = await supabase
        .from("ai_usage")
        .select("function_name, estimated_cost_usd")
        .eq("user_id", user.id)
        .eq("month_key", getMonthKey());

      if (error) throw error;

      const usedUsd = (data || []).reduce(
        (sum, row: any) => sum + Number(row.estimated_cost_usd || 0),
        0,
      );
      const usedEur = usedUsd * EUR_USD;
      const budgetEur = MONTHLY_BUDGET_USD * EUR_USD;
      const ratio = usedUsd / MONTHLY_BUDGET_USD;

      let status: AIUsageSummary["status"] = "ok";
      if (ratio >= 1.5) status = "hard_capped";
      else if (ratio >= 1.0) status = "soft_capped";
      else if (ratio >= 0.8) status = "warning";

      // Aggregate breakdown
      const byFn = new Map<string, number>();
      for (const row of data || []) {
        const r = row as any;
        const cur = byFn.get(r.function_name) || 0;
        byFn.set(r.function_name, cur + Number(r.estimated_cost_usd || 0) * EUR_USD);
      }
      const breakdown = Array.from(byFn.entries())
        .map(([function_name, cost_eur]) => ({ function_name, cost_eur }))
        .sort((a, b) => b.cost_eur - a.cost_eur);

      return {
        used_eur: usedEur,
        budget_eur: budgetEur,
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
