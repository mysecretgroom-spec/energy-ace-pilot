import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useSaasAccess } from "@/hooks/useSaasAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Abonnement() {
  const { accessState, subscription, isLoading, daysLeftInTrial, isInTrial, isActive } = useSaasAccess();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("saas-create-checkout-session", {
        body: {},
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("saas-create-portal-session", {
        body: {},
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
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
              {isInTrial && (
                <Badge variant="secondary">Essai gratuit</Badge>
              )}
              {isActive && (
                <Badge className="bg-green-500">Actif</Badge>
              )}
              {accessState?.app_access === "paywall" && (
                <Badge variant="destructive">Expiré</Badge>
              )}
              {accessState?.app_access === "blocked" && (
                <Badge variant="destructive">Suspendu</Badge>
              )}
            </div>

            {isInTrial && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jours restants</span>
                <span className={`font-bold ${daysLeftInTrial <= 3 ? "text-destructive" : ""}`}>
                  {daysLeftInTrial} jours
                </span>
              </div>
            )}

            {accessState?.trial_ends_at && isInTrial && (
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
        {!isActive ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Abonnement Premium</CardTitle>
                <Badge variant="secondary">Recommandé</Badge>
              </div>
              <CardDescription>Accès complet à toutes les fonctionnalités</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold">29€</span>
                <span className="text-muted-foreground">/mois</span>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Gestion complète du planning</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Suivi CRM et ventes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Synchronisation Gmail</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Gestion des frais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Notifications push</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Support prioritaire</span>
                </li>
              </ul>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubscribe}
                disabled={isSubscribing}
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  "S'abonner maintenant"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Paiement sécurisé. Annulez à tout moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Gérer mon abonnement</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleManageBilling}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Accéder au portail de facturation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
