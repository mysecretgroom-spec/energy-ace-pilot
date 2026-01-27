import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Zap, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface PuissanceData {
  id: string;
  pac_subtype: "air_air" | "air_eau";
  surface_min: number;
  surface_max: number;
  puissance_recommandee: number;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataPuissancesPAC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PuissanceData[]>([]);
  const [originalData, setOriginalData] = useState<PuissanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: puissanceData, error } = await supabase
        .from("data_pac_puissances")
        .select("*")
        .order("pac_subtype", { ascending: true })
        .order("surface_min", { ascending: true });

      if (error) throw error;
      const formattedData = (puissanceData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement puissances:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: PuissanceData = {
      id: `new-${Date.now()}`,
      pac_subtype: "air_eau",
      surface_min: 0,
      surface_max: 100,
      puissance_recommandee: 8,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([...data, newItem]);
    setHasChanges(true);
  };

  const handleChange = (id: string, field: keyof PuissanceData, value: any) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value, isModified: true };
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    const item = data.find(d => d.id === id);
    if (item?.isGlobal) {
      toast.error("Impossible de supprimer une donnée globale");
      return;
    }
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    setData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const modifiedItems = data.filter(item => item.isModified && !item.isGlobal);
      const deletedItems = originalData.filter(
        orig => !data.some(d => d.id === orig.id) && !orig.isGlobal
      );

      for (const item of deletedItems) {
        await supabase.from("data_pac_puissances").delete().eq("id", item.id);
      }

      for (const item of modifiedItems) {
        const payload = {
          pac_subtype: item.pac_subtype,
          surface_min: item.surface_min,
          surface_max: item.surface_max,
          puissance_recommandee: item.puissance_recommandee,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          await supabase.from("data_pac_puissances").insert(payload);
        } else {
          await supabase.from("data_pac_puissances").update(payload).eq("id", item.id);
        }
      }

      toast.success("Données sauvegardées");
      fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Puissances PAC recommandées" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Puissances par Surface
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Définit la puissance calorifique recommandée (en kW) en fonction de la surface à chauffer.
                Utilisé pour pré-remplir les études PAC.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {data.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      item.isModified ? "border-primary bg-primary/5" : "border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.isGlobal ? (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <Globe className="h-3 w-3" /> Global
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 bg-blue-50">
                            <User className="h-3 w-3" /> Perso
                          </Badge>
                        )}
                        <Switch
                          checked={item.actif}
                          onCheckedChange={(checked) => handleChange(item.id, "actif", checked)}
                          disabled={item.isGlobal}
                        />
                      </div>
                      {!item.isGlobal && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type PAC</label>
                        <Select
                          value={item.pac_subtype}
                          onValueChange={(val) => handleChange(item.id, "pac_subtype", val)}
                          disabled={item.isGlobal}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="air_air">Air/Air</SelectItem>
                            <SelectItem value="air_eau">Air/Eau</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Surface min (m²)</label>
                        <Input
                          type="number"
                          value={item.surface_min}
                          onChange={(e) => handleChange(item.id, "surface_min", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Surface max (m²)</label>
                        <Input
                          type="number"
                          value={item.surface_max}
                          onChange={(e) => handleChange(item.id, "surface_max", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Puissance (kW)</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={item.puissance_recommandee}
                          onChange={(e) => handleChange(item.id, "puissance_recommandee", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button variant="outline" className="flex-1" onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default DataPuissancesPAC;
