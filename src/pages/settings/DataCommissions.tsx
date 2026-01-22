import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Percent, Loader2, TrendingUp } from "lucide-react";

interface CommissionData {
  id: string;
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
  bonus_survente: number | null;
}

const DataCommissions = () => {
  const [data, setData] = useState<CommissionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: commissionData, error } = await supabase
        .from("data_commissions")
        .select("*")
        .order("tranche_min", { ascending: true });

      if (error) throw error;
      setData(commissionData || []);
    } catch (error) {
      console.error("Erreur chargement commissions:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const maxTaux = Math.max(...data.map(d => d.taux_commission), 1);

  return (
    <MobileLayout title="Grilles commissions" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Percent className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Barème de commissions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Taux appliqué sur le montant de la vente selon les tranches de prix. Le bonus survente s'ajoute si le prix dépasse le recommandé.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune grille configurée</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tranches de prix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.map((item, index) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {formatCurrency(item.tranche_min)} - {formatCurrency(item.tranche_max)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700">
                        {item.taux_commission}%
                      </Badge>
                      {item.bonus_survente && item.bonus_survente > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          +{item.bonus_survente}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={(item.taux_commission / maxTaux) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Exemple de calcul */}
        {data.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Exemple de calcul
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pour une vente à 15 000€ avec un taux de {data[0]?.taux_commission || 10}% :
              </p>
              <p className="font-bold text-lg text-primary">
                Commission = {formatCurrency(15000 * (data[0]?.taux_commission || 10) / 100)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
};

export default DataCommissions;
