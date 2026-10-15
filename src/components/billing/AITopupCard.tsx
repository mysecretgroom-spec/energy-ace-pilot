import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { TOPUPS, formatEur } from "@/lib/plans";

export function AITopupCard() {
  const { user } = useAuth();
  const { openCheckout, loading } = usePaddleCheckout();
  const { data: balance = 0 } = useQuery({
    queryKey: ["ai-topup-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_topup_balance", { p_user_id: user!.id });
      return Number(data || 0);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Recharges IA</CardTitle>
        <CardDescription>
          Utilisées uniquement quand votre quota IA mensuel est dépassé. Crédit restant : <strong>{formatEur(balance)}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        {TOPUPS.map((t) => (
          <Button key={t.priceId} variant="outline" disabled={loading} onClick={() => openCheckout(t.priceId, "/abonnement?topup=success")}>
            + {t.amount} €
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
