import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function usePaddleCheckout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const openCheckout = async (priceId: string, successPath = "/abonnement?checkout=success") => {
    if (!user) return;
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        customData: { userId: user.id },
        settings: {
          displayMode: "overlay",
          locale: "fr",
          successUrl: `${window.location.origin}${successPath}`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e: any) {
      toast.error("Impossible d'ouvrir le paiement. Réessayez.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
