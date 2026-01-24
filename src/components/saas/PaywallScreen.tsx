import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaywallScreenProps {
  isBlocked?: boolean;
  daysLeft?: number;
}

export function PaywallScreen({ isBlocked = false, daysLeft = 0 }: PaywallScreenProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          {isBlocked ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-destructive">Compte Suspendu</h1>
              <p className="text-muted-foreground">
                Votre compte a été suspendu en raison d'un impayé. 
                Veuillez régulariser votre situation pour continuer.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Votre essai est terminé</h1>
              <p className="text-muted-foreground">
                Abonnez-vous pour continuer à utiliser toutes les fonctionnalités
              </p>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Abonnement Premium</CardTitle>
              <Badge variant="secondary">Populaire</Badge>
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
                <span>Synchronisation Gmail automatique</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span>Gestion des frais et commissions</span>
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
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirection...
                </>
              ) : (
                "S'abonner maintenant"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Paiement sécurisé par Stripe. Annulez à tout moment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
