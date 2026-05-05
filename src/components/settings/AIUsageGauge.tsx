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

  const statusBadge =
    data.status === "hard_capped"
      ? { label: "Hard cap atteint — agent suspendu", cls: "bg-destructive/15 text-destructive border-destructive/30" }
      : data.status === "soft_capped"
      ? { label: "Soft cap — mode économique", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" }
      : data.status === "warning"
      ? { label: "Warning — approche du seuil", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30" }
      : { label: "OK — consommation normale", cls: "bg-primary/10 text-primary border-primary/20" };

  const resetLabel = data.reset_date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  const top3 = data.breakdown.slice(0, 3);

  // Position des seuils sur la barre (échelle 0..150% écrasée à 100%)
  const SCALE_MAX = 150;
  const warningPos = (80 / SCALE_MAX) * 100;
  const softPos = (100 / SCALE_MAX) * 100;
  const barWidth = Math.min((data.ratio * 100 / SCALE_MAX) * 100, 100);

  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Consommation IA ce mois</h3>
          </div>
          <span className="text-sm font-bold tabular-nums">
            {formatTokens(data.used_tokens)} / {formatTokens(data.soft_cap_tokens)} tokens
          </span>
        </div>

        <div className="relative h-2.5 w-full overflow-visible rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all", color)}
            style={{ width: `${barWidth}%` }}
          />
          {/* Marqueurs de seuils */}
          <div
            className="absolute top-[-2px] bottom-[-2px] w-px bg-yellow-500/70"
            style={{ left: `${warningPos}%` }}
            title={`Warning: ${formatTokens(data.warning_tokens)}`}
          />
          <div
            className="absolute top-[-2px] bottom-[-2px] w-px bg-orange-500/80"
            style={{ left: `${softPos}%` }}
            title={`Soft cap: ${formatTokens(data.soft_cap_tokens)}`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span style={{ marginLeft: `${warningPos - 8}%` }}>
            ⚠ {formatTokens(data.warning_tokens)}
          </span>
          <span>
            ⛔ {formatTokens(data.soft_cap_tokens)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border", statusBadge.cls)}>
            {data.status !== "ok" && <AlertTriangle className="h-3 w-3" />}
            {statusBadge.label} · {Math.round(data.ratio * 100)} %
          </span>
          <span className="text-muted-foreground shrink-0">Reset le {resetLabel}</span>
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
                  · {formatTokens(item.tokens)}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
