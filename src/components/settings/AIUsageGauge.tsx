import { Card, CardContent } from "@/components/ui/card";
// Progress import removed (custom bar inlined)
import { Sparkles, AlertTriangle } from "lucide-react";
import { useAIUsage, getFunctionLabel, formatTokens } from "@/hooks/useAIUsage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AIUsageGauge() {
  const { data, isLoading } = useAIUsage();

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const percent = Math.min(Math.round(data.ratio * 100), 200);
  const color =
    data.status === "hard_capped"
      ? "bg-destructive"
      : data.status === "soft_capped"
      ? "bg-orange-500"
      : data.status === "warning"
      ? "bg-yellow-500"
      : "bg-primary";

  const statusLabel =
    data.status === "hard_capped"
      ? "Budget dépassé — agent suspendu"
      : data.status === "soft_capped"
      ? "Mode économique activé"
      : data.status === "warning"
      ? "Approche du budget mensuel"
      : "Consommation normale";

  const resetLabel = data.reset_date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  const top3 = data.breakdown.slice(0, 3);

  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Consommation IA ce mois</h3>
          </div>
          <span className="text-sm font-bold tabular-nums">
            {data.used_eur.toFixed(2)} € / {data.budget_eur.toFixed(0)} €
          </span>
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full transition-all", color)}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
          {percent > 100 && (
            <div className="absolute inset-0 rounded-full ring-2 ring-destructive/40 pointer-events-none" />
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              "flex items-center gap-1",
              data.status !== "ok" ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
            )}
          >
            {data.status !== "ok" && <AlertTriangle className="h-3 w-3" />}
            {statusLabel}
          </span>
          <span className="text-muted-foreground">Reset le {resetLabel}</span>
        </div>

        {top3.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <p className="text-[10px] uppercase font-medium text-muted-foreground tracking-wide">
              Détail
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {top3.map((item) => (
                <span key={item.function_name} className="text-muted-foreground">
                  <span className="text-foreground font-medium">{getFunctionLabel(item.function_name)}</span>{" "}
                  · {item.cost_eur.toFixed(2)} €
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
