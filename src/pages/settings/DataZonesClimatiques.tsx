import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MapPin, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface ZoneData {
  id: string;
  department_code: string;
  department_name: string;
  zone_climatique: string;
  dju_base18: number;
  altitude_moyenne: number | null;
  description: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataZonesClimatiques = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ZoneData[]>([]);
  const [originalData, setOriginalData] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: zoneData, error } = await supabase
        .from("data_zones_climatiques")
        .select("*")
        .order("department_code", { ascending: true });

      if (error) throw error;
      const formattedData = (zoneData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: ZoneData = {
      id: `new-${Date.now()}`,
      department_code: "",
      department_name: "",
      zone_climatique: "H2a",
      dju_base18: 2000,
      altitude_moyenne: null,
      description: null,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([...data, newItem]);
    setHasChanges(true);
  };

  const handleChange = (id: string, field: keyof ZoneData, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value, isModified: true } : item));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    const item = data.find(d => d.id === id);
    if (item?.isGlobal) { toast.error("Impossible de supprimer une donnée globale"); return; }
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => { setData(JSON.parse(JSON.stringify(originalData))); setHasChanges(false); };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const modifiedItems = data.filter(item => item.isModified && !item.isGlobal);
      const deletedItems = originalData.filter(orig => !data.some(d => d.id === orig.id) && !orig.isGlobal);

      for (const item of deletedItems) {
        await supabase.from("data_zones_climatiques").delete().eq("id", item.id);
      }

      for (const item of modifiedItems) {
        const payload = {
          department_code: item.department_code,
          department_name: item.department_name,
          zone_climatique: item.zone_climatique,
          dju_base18: item.dju_base18,
          altitude_moyenne: item.altitude_moyenne,
          description: item.description,
          actif: item.actif,
          user_id: user.id,
        };
        if (item.isNew) {
          await supabase.from("data_zones_climatiques").insert(payload);
        } else {
          await supabase.from("data_zones_climatiques").update(payload).eq("id", item.id);
        }
      }
      // Silent save
      fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const getZoneColor = (zone: string) => {
    if (zone.startsWith("H1")) return "bg-blue-100 text-blue-700";
    if (zone.startsWith("H2")) return "bg-amber-100 text-amber-700";
    return "bg-orange-100 text-orange-700";
  };

  return (
    <MobileLayout title="Zones Climatiques (DJU)" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Degrés-Jours Unifiés par Département
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Les DJU (base 18°C) permettent d'estimer les besoins de chauffage annuels selon la rigueur climatique.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {data.map((item) => (
                  <div key={item.id} className={`p-3 rounded-lg border ${item.isModified ? "border-primary bg-primary/5" : "border-muted"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.isGlobal ? (
                          <Badge variant="outline" className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Global</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50"><User className="h-3 w-3" /> Perso</Badge>
                        )}
                        <Badge className={`text-xs ${getZoneColor(item.zone_climatique)}`}>{item.zone_climatique}</Badge>
                        <Switch checked={item.actif} onCheckedChange={(checked) => handleChange(item.id, "actif", checked)} disabled={item.isGlobal} />
                      </div>
                      {!item.isGlobal && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Dépt</label>
                        <Input value={item.department_code} onChange={(e) => handleChange(item.id, "department_code", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Département</label>
                        <Input value={item.department_name} onChange={(e) => handleChange(item.id, "department_name", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">DJU</label>
                        <Input type="number" value={item.dju_base18} onChange={(e) => handleChange(item.id, "dju_base18", parseInt(e.target.value) || 0)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-[5.5rem] left-0 right-0 p-4 bg-background border-t z-40">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button variant="outline" className="flex-1" onClick={handleAddNew}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}><RotateCcw className="h-4 w-4" /></Button>
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

export default DataZonesClimatiques;
