import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Calendar, AlertCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const MONTHLY_LINK = "https://buy.stripe.com/5kQfZa7Dfchb9Et7Oc7ok01";
const ANNUAL_LINK = "https://buy.stripe.com/cNieV66zb2GBdUJecA7ok02";

export default function Abonnement() {
  const { user } = useAuth();
  const { accessState, subscription, isLoading, daysLeftInTrial, isInTrial, isActive, isBetaTester } = useSaasAccess();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const handleSubscribe = () => {
    const baseUrl = billingCycle === "monthly" ? MONTHLY_LINK : ANNUAL_LINK;
    const params = new URLSearchParams();
    if (user?.email) params.set("prefilled_email", user.email);
    if (user?.id) params.set("client_reference_id", user.id);
    window.location.href = `${baseUrl}?${params.toString()}`;
  };

  const handleManageBilling = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("saas-create-portal-session", { body: {} });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout title="Abonnement">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Abonnement">
      <div className="p-4 space-y-6">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Votre Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Statut</span>
              {isBetaTester && (
                <Badge className="bg-purple-500"><Star className="h-3 w-3 mr-1" />Bêta-testeur</Badge>
              )}
              {!isBetaTester && isInTrial && (
                <Badge variant="secondary">Essai gratuit</Badge>
              )}
              {!isBetaTester && isActive && (
                <Badge className="bg-green-500">Actif</Badge>
              )}
              {accessState?.app_access === "paywall" && !isBetaTester && (
                <Badge variant="destructive">Expiré</Badge>
              )}
              {accessState?.app_access === "blocked" && !isBetaTester && (
                <Badge variant="destructive">Suspendu</Badge>
              )}
            </div>

            {isInTrial && !isBetaTester && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jours restants</span>
                <span className={`font-bold ${daysLeftInTrial <= 3 ? "text-destructive" : ""}`}>
                  {daysLeftInTrial} jours
                </span>
              </div>
            )}

            {accessState?.trial_ends_at && isInTrial && !isBetaTester && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fin de l'essai</span>
                <span>{format(new Date(accessState.trial_ends_at), "dd MMMM yyyy", { locale: fr })}</span>
              </div>
            )}

            {subscription?.current_period_end && isActive && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prochaine facturation</span>
                <span>{format(new Date(subscription.current_period_end), "dd MMMM yyyy", { locale: fr })}</span>
              </div>
            )}

            {subscription?.status === "past_due" && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Paiement en attente</p>
                  <p className="text-muted-foreground">
                    Veuillez mettre à jour votre moyen de paiement pour éviter la suspension.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscribe or Manage */}
        {!isActive && !isBetaTester ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Abonnement Premium</CardTitle>
                <Badge variant="secondary">Recommandé</Badge>
              </div>
              <CardDescription>Accès complet à toutes les fonctionnalités</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Billing cycle toggle */}
              <div className="flex items-center justify-center gap-2 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    billingCycle === "monthly"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setBillingCycle("annual")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    billingCycle === "annual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Annuel
                  <Badge variant="default" className="ml-1.5 text-[10px] px-1.5 py-0">-16%</Badge>
                </button>
              </div>

              <div className="text-center">
                {billingCycle === "monthly" ? (
                  <>
                    <span className="text-4xl font-bold">55,26€</span>
                    <span className="text-muted-foreground">/mois</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-bold">555,26€</span>
                    <span className="text-muted-foreground">/an</span>
                    <p className="text-sm text-muted-foreground mt-1">soit 46,27€/mois</p>
                  </>
                )}
              </div>

              <ul className="space-y-3">
                {[
                  "Gestion complète du planning",
                  "Suivi CRM et ventes",
                  "Synchronisation Gmail",
                  "Gestion des frais",
                  "Notifications push",
                  "Support prioritaire",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full" size="lg" onClick={handleSubscribe}>
                S'abonner maintenant
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Paiement sécurisé. Annulez à tout moment.
              </p>
            </CardContent>
          </Card>
        ) : isActive ? (
          <Card>
            <CardHeader>
              <CardTitle>Gérer mon abonnement</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                <Calendar className="h-4 w-4 mr-2" />
                Accéder au portail de facturation
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileLayout>
  );
}
