import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Compass, Loader2 } from "lucide-react";

interface OrientationData {
  id: string;
  orientation: string;
  inclinaison: number;
  coefficient: number;
}

const orientationLabels: Record<string, string> = {
  sud: "Sud",
  sud_est: "Sud-Est",
  sud_ouest: "Sud-Ouest",
  est: "Est",
  ouest: "Ouest",
  nord: "Nord",
};

const DataOrientation = () => {
  const [data, setData] = useState<OrientationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: orientationData, error } = await supabase
        .from("data_orientation")
        .select("*")
        .order("orientation", { ascending: true })
        .order("inclinaison", { ascending: true });

      if (error) throw error;
      setData(orientationData || []);
    } catch (error) {
      console.error("Erreur chargement orientation:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  // Grouper par orientation
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.orientation]) {
      acc[item.orientation] = [];
    }
    acc[item.orientation].push(item);
    return acc;
  }, {} as Record<string, OrientationData[]>);

  const getCoeffColor = (coeff: number) => {
    if (coeff >= 0.95) return "text-green-600 bg-green-100";
    if (coeff >= 0.85) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <MobileLayout title="Coefficients orientation" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Compass className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Coefficients de production</p>
              <p className="text-xs text-muted-foreground mt-1">
                Multiplicateur appliqué à la production selon l'orientation et l'inclinaison des panneaux. 1.00 = production optimale.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Liste par orientation */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Aucune donnée disponible</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedData).map(([orientation, items]) => (
            <Card key={orientation}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  {orientationLabels[orientation] || orientation}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Inclinaison {item.inclinaison}°
                      </span>
                      <Badge className={getCoeffColor(item.coefficient)}>
                        ×{item.coefficient.toFixed(2)}
                      </Badge>
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

export default DataOrientation;
