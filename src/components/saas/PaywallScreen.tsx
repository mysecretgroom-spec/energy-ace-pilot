import { Lock } from "lucide-react";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { PaymentTestModeBanner } from "@/components/billing/PaymentTestModeBanner";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

interface PaywallScreenProps {
  isBlocked?: boolean;
  daysLeft?: number;
}


export function PaywallScreen({ isBlocked = false }: PaywallScreenProps) {
  const { openCheckout, loading } = usePaddleCheckout();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
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

        <PaymentTestModeBanner />
        <PlanPicker busy={loading} onSelect={(priceId) => openCheckout(priceId)} />
      </div>
    </div>
  );
}
