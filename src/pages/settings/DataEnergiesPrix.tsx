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
import { Flame, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface EnergieData {
  id: string;
  type_energie: string;
  prix_kwh: number;
  unite: string;
  pouvoir_calorifique_kwh: number | null;
  description: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataEnergiesPrix = () => {
  const { user } = useAuth();
  const [data, setData] = useState<EnergieData[]>([]);
  const [originalData, setOriginalData] = useState<EnergieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: energieData, error } = await supabase
        .from("data_energies_prix")
        .select("*")
        .order("type_energie", { ascending: true });

      if (error) throw error;
      const formattedData = (energieData || []).map(item => ({
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
    const newItem: EnergieData = {
      id: `new-${Date.now()}`,
      type_energie: "nouvelle_energie",
      prix_kwh: 0.10,
      unite: "kWh",
      pouvoir_calorifique_kwh: 1,
      description: "",
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([...data, newItem]);
    setHasChanges(true);
  };

  const handleChange = (id: string, field: keyof EnergieData, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value, isModified: true } : item));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    const item = data.find(d => d.id === id);
    if (item?.isGlobal) { toast.error("Impossible de supprimer une donnée globale"); return; }
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
      const deletedItems = originalData.filter(orig => !data.some(d => d.id === orig.id) && !orig.isGlobal);

      for (const item of deletedItems) {
        await supabase.from("data_energies_prix").delete().eq("id", item.id);
      }

      for (const item of modifiedItems) {
        const payload = {
          type_energie: item.type_energie,
          prix_kwh: item.prix_kwh,
          unite: item.unite,
          pouvoir_calorifique_kwh: item.pouvoir_calorifique_kwh,
          description: item.description,
          actif: item.actif,
          user_id: user.id,
        };
        if (item.isNew) {
          await supabase.from("data_energies_prix").insert(payload);
        } else {
          await supabase.from("data_energies_prix").update(payload).eq("id", item.id);
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
    <MobileLayout title="Prix Énergies Fossiles" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Prix par Type d'Énergie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-orange-50 rounded-lg p-3 text-xs text-orange-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Prix en €/kWh pour calculer les économies lors du remplacement d'un chauffage fossile par une PAC.</p>
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
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1"><Globe className="h-3 w-3" /> Global</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 bg-orange-50"><User className="h-3 w-3" /> Perso</Badge>
                        )}
                        <Switch checked={item.actif} onCheckedChange={(checked) => handleChange(item.id, "actif", checked)} disabled={item.isGlobal} />
                      </div>
                      {!item.isGlobal && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type d'énergie</label>
                        <Input value={item.type_energie} onChange={(e) => handleChange(item.id, "type_energie", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Prix (€/kWh)</label>
                        <Input type="number" step="0.001" value={item.prix_kwh} onChange={(e) => handleChange(item.id, "prix_kwh", parseFloat(e.target.value) || 0)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground">Description</label>
                      <Input value={item.description || ""} onChange={(e) => handleChange(item.id, "description", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t">
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

export default DataEnergiesPrix;
