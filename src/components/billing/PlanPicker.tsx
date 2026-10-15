import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { PLANS, PlanTier, BillingCycle, priceIdFor, yearlySavings, formatEur } from "@/lib/plans";

interface Props {
  currentPriceId?: string | null;
  busy?: boolean;
  onSelect: (priceId: string) => void;
}

export function PlanPicker({ currentPriceId, busy, onSelect }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>(currentPriceId?.endsWith("yearly") ? "yearly" : "monthly");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
        {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${cycle === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {c === "monthly" ? "Mensuel" : "Annuel"}
            {c === "yearly" && <Badge className="ml-1.5 text-[10px] px-1.5 py-0">2 mois offerts</Badge>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PLANS) as PlanTier[]).map((tier) => {
          const plan = PLANS[tier];
          const priceId = priceIdFor(tier, cycle);
          const isCurrent = currentPriceId === priceId;
          return (
            <Card key={tier} className={tier === "premium" ? "border-primary border-2" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display">{plan.name}</CardTitle>
                  {tier === "premium" && <Badge>HEJJA inclus</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">{formatEur(cycle === "monthly" ? plan.monthly : plan.yearly)}</span>
                  <span className="text-muted-foreground"> TTC/{cycle === "monthly" ? "mois" : "an"}</span>
                  {cycle === "yearly" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      soit {formatEur(plan.yearly / 12)}/mois, {formatEur(yearlySavings(tier))} d'économie
                    </p>
                  )}
                </div>
                <ul className="space-y-2 text-sm">
                  {[...plan.features, `${plan.aiBudgetEur} € d'IA inclus chaque mois`].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={tier === "premium" ? "default" : "outline"} disabled={busy || isCurrent} onClick={() => onSelect(priceId)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Offre actuelle" : currentPriceId ? `Passer en ${plan.name}` : `Choisir ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Paiement sécurisé. Passage en Premium immédiat (au prorata) ; retour en Classique à la fin de la période payée. Résiliable à tout moment.
      </p>
    </div>
  );
}
