import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PaywallScreenProps {
  isBlocked?: boolean;
  daysLeft?: number;
}

const MONTHLY_LINK = "https://buy.stripe.com/5kQfZa7Dfchb9Et7Oc7ok01";
const ANNUAL_LINK = "https://buy.stripe.com/cNieV66zb2GBdUJecA7ok02";

export function PaywallScreen({ isBlocked = false }: PaywallScreenProps) {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const handleSubscribe = () => {
    const baseUrl = billingCycle === "monthly" ? MONTHLY_LINK : ANNUAL_LINK;
    const params = new URLSearchParams();
    if (user?.email) params.set("prefilled_email", user.email);
    if (user?.id) params.set("client_reference_id", user.id);
    window.location.href = `${baseUrl}?${params.toString()}`;
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
                  <p className="text-sm text-muted-foreground mt-1">
                    soit 46,27€/mois
                  </p>
                </>
              )}
            </div>

            <ul className="space-y-3">
              {[
                "Gestion complète du planning",
                "Suivi CRM et ventes",
                "Résultats d'études complets",
                "Mode HEJJA",
                "Synchronisation Gmail automatique",
                "Gestion des frais et commissions",
                "Notifications push",
                "Support prioritaire",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleSubscribe}
            >
              S'abonner maintenant
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
