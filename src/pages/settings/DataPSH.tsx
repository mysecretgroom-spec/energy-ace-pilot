import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sun, Search, Loader2 } from "lucide-react";

interface PSHData {
  id: string;
  department_code: string;
  department_name: string;
  psh_value: number;
  max_psh_value: number;
}

const DataPSH = () => {
  const [data, setData] = useState<PSHData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pshData, error } = await supabase
        .from("data_psh")
        .select("*")
        .order("department_code", { ascending: true });

      if (error) throw error;
      setData(pshData || []);
    } catch (error) {
      console.error("Erreur chargement PSH:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(d => 
    d.department_name.toLowerCase().includes(search.toLowerCase()) ||
    d.department_code.includes(search)
  );

  return (
    <MobileLayout title="PSH par département" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Sun className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Peak Sun Hours (PSH)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nombre d'heures d'ensoleillement optimal par jour, utilisé pour calculer la production annuelle des panneaux.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un département..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Départements</span>
              <Badge variant="secondary">{filteredData.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun résultat</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filteredData.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {item.department_code}
                        </Badge>
                        <span className="font-medium text-sm">{item.department_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{item.psh_value} h</p>
                      <p className="text-xs text-muted-foreground">
                        max: {item.max_psh_value} h
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
};

export default DataPSH;
