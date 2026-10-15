import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, AlertCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { AITopupCard } from "@/components/billing/AITopupCard";
import { PaymentTestModeBanner } from "@/components/billing/PaymentTestModeBanner";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";
import { PLANS, tierOfPriceId } from "@/lib/plans";

const fmt = (d?: string | null) => (d ? format(new Date(d), "dd MMMM yyyy", { locale: fr }) : "-");

export default function Abonnement() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { accessState, isLoading, daysLeftInTrial, isInTrial, isBetaTester, plan, paidSubscription: sub } = useSaasAccess();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [busy, setBusy] = useState(false);

  const activeSub = sub && ["active", "trialing", "past_due"].includes(sub.status) ? sub : null;

  // After checkout, the confirmation arrives a few seconds later: refresh until it shows.
  useEffect(() => {
    const flag = params.get("checkout") || params.get("topup");
    if (!flag) return;
    toast.success(params.get("topup") ? "Recharge en cours d'enregistrement…" : "Paiement reçu, activation en cours…");
    let n = 0;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["saas-access-state"] });
      qc.invalidateQueries({ queryKey: ["ai-topup-balance"] });
      if (++n >= 6) clearInterval(id);
    }, 2500);
    setParams({}, { replace: true });
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const callManage = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("paddle-manage", {
      body: { ...body, environment: getPaddleEnvironment() },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    return data;
  };

  const handleSelect = async (priceId: string) => {
    if (!activeSub) return openCheckout(priceId);
    setBusy(true);
    try {
      const res = await callManage({ action: "change_plan", priceId });
      toast.success(res.mode === "immediate"
        ? "Offre mise à jour. La différence est facturée au prorata."
        : `Changement prévu le ${fmt(res.effective_at)}. Vous gardez votre offre actuelle jusque-là.`);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["billing"] }), 2500);
    } catch (e: any) {
      toast.error(`Changement impossible : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePortal = async () => {
    try {
      const { url } = await callManage({ action: "portal" });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout title="Abonnement">
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </MobileLayout>
    );
  }

  const currentTier = tierOfPriceId(activeSub?.price_id);
  const scheduledTier = tierOfPriceId(activeSub?.scheduled_price_id);

  return (
    <MobileLayout title="Abonnement">
      <div className="p-4 space-y-6">
        <PaymentTestModeBanner />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Votre abonnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Offre</span>
              {isBetaTester ? <Badge><Star className="h-3 w-3 mr-1" />Bêta-testeur (Premium)</Badge>
                : activeSub ? <Badge>{PLANS[currentTier ?? "classique"].name} · {activeSub.price_id.endsWith("yearly") ? "annuel" : "mensuel"}</Badge>
                : plan === "premium" ? <Badge>Premium (offert)</Badge>
                : isInTrial ? <Badge variant="secondary">Essai gratuit</Badge>
                : <Badge variant="destructive">Aucune offre</Badge>}
            </div>
            {isInTrial && !activeSub && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fin de l'essai</span>
                <span>{fmt(accessState?.trial_ends_at)} ({daysLeftInTrial} j)</span>
              </div>
            )}
            {activeSub && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{activeSub.cancel_at_period_end ? "Fin de l'accès" : "Prochaine facturation"}</span>
                <span>{fmt(activeSub.current_period_end)}</span>
              </div>
            )}
            {activeSub?.scheduled_price_id && plan === "premium" && scheduledTier === "classique" && (
              <p className="text-muted-foreground">Passage en Classique prévu le {fmt(activeSub.premium_until)}. Premium actif jusque-là.</p>
            )}
            {activeSub?.status === "past_due" && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p>Paiement en échec. Mettez à jour votre moyen de paiement pour éviter la suspension.</p>
              </div>
            )}
            {activeSub && (
              <Button variant="outline" className="w-full" onClick={handlePortal}>
                Moyen de paiement, factures et résiliation
              </Button>
            )}
          </CardContent>
        </Card>

        {!isBetaTester && (
          <PlanPicker currentPriceId={activeSub?.price_id} busy={busy || checkoutLoading} onSelect={handleSelect} />
        )}

        <AITopupCard />
      </div>
    </MobileLayout>
  );
}
