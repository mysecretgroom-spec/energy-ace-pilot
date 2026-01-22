import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, Loader2, Package } from "lucide-react";

interface BouquetData {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  description: string | null;
  actif: boolean;
}

const DataBouquets = () => {
  const [data, setData] = useState<BouquetData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bouquetData, error } = await supabase
        .from("data_prix_bouquets")
        .select("*")
        .order("puissance_kwc", { ascending: true });

      if (error) throw error;
      setData(bouquetData || []);
    } catch (error) {
      console.error("Erreur chargement bouquets:", error);
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

  return (
    <MobileLayout title="Prix bouquets" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs installations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prix des installations selon la puissance. Le prix recommandé est la base de calcul, le prix max est le plafond autorisé.
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
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun bouquet configuré</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <Card key={item.id} className={!item.actif ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.nom_bouquet}</h3>
                        {!item.actif && <Badge variant="secondary">Inactif</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.puissance_kwc} kWc
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg font-bold">
                      {item.puissance_kwc} kWc
                    </Badge>
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Prix recommandé</p>
                      <p className="font-bold text-primary">
                        {formatCurrency(item.prix_recommande)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prix maximum</p>
                      <p className="font-bold text-amber-600">
                        {formatCurrency(item.prix_max)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default DataBouquets;
