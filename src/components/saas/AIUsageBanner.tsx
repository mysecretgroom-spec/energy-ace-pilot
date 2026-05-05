import { useState } from "react";
import { useAIUsage } from "@/hooks/useAIUsage";
import { AlertTriangle, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function AIUsageBanner() {
  const { data } = useAIUsage();
  const [dismissed, setDismissed] = useState(false);

  if (!data || dismissed) return null;
  if (data.status === "ok") return null;

  const isCapped = data.status === "soft_capped" || data.status === "hard_capped";

  const message =
    data.status === "hard_capped"
      ? "Budget IA mensuel dépassé — agent suspendu jusqu'au prochain mois."
      : data.status === "soft_capped"
      ? "Budget IA atteint — mode économique activé (modèle plus rapide)."
      : `Vous avez utilisé ${Math.round(data.ratio * 100)} % de votre budget IA mensuel.`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-xs border-b",
        isCapped
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isCapped ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
        )}
        <Link to="/parametres" className="truncate underline-offset-2 hover:underline">
          {message}
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-70 hover:opacity-100"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
