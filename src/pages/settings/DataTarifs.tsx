import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Euro, Loader2, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TarifData {
  id: string;
  type_revente: string;
  puissance_min: number;
  puissance_max: number;
  prix_kwh: number;
  date_effet: string;
  actif: boolean;
}

const typeLabels: Record<string, string> = {
  revente_totale: "Revente totale",
  revente_surplus: "Revente surplus",
  autoconsommation: "Autoconsommation",
};

const DataTarifs = () => {
  const [data, setData] = useState<TarifData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tarifData, error } = await supabase
        .from("data_tarifs_revente")
        .select("*")
        .order("type_revente", { ascending: true })
        .order("puissance_min", { ascending: true });

      if (error) throw error;
      setData(tarifData || []);
    } catch (error) {
      console.error("Erreur chargement tarifs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  // Grouper par type
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.type_revente]) {
      acc[item.type_revente] = [];
    }
    acc[item.type_revente].push(item);
    return acc;
  }, {} as Record<string, TarifData[]>);

  return (
    <MobileLayout title="Tarifs revente" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Euro className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs de rachat EDF OA</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prix de rachat du kWh selon le type de contrat et la puissance installée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Liste par type */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun tarif configuré</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedData).map(([type, items]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  {typeLabels[type] || type}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">
                          {item.puissance_min} - {item.puissance_max} kWc
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">
                            {(item.prix_kwh * 100).toFixed(2)} c€/kWh
                          </span>
                          {!item.actif && (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Depuis le {format(new Date(item.date_effet), "d MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </MobileLayout>
  );
};

export default DataTarifs;
