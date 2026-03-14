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
import { TrendingUp, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface EvolutionData {
  id: string;
  type_energie: string;
  taux_augmentation_annuel: number;
  description: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataEvolutionPrix = () => {
  const { user } = useAuth();
  const [data, setData] = useState<EvolutionData[]>([]);
  const [originalData, setOriginalData] = useState<EvolutionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from("data_evolution_prix_energie")
        .select("*")
        .order("type_energie", { ascending: true });

      if (error) throw error;
      const formatted = (items || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formatted);
      setOriginalData(JSON.parse(JSON.stringify(formatted)));
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
    const newItem: EvolutionData = {
      id: `new-${Date.now()}`,
      type_energie: "nouvelle_energie",
      taux_augmentation_annuel: 4,
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

  const handleChange = (id: string, field: keyof EvolutionData, value: any) => {
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
        await supabase.from("data_evolution_prix_energie").delete().eq("id", item.id);
      }

      for (const item of modifiedItems) {
        const payload = {
          type_energie: item.type_energie,
          taux_augmentation_annuel: item.taux_augmentation_annuel,
          description: item.description,
          actif: item.actif,
          user_id: user.id,
        };
        if (item.isNew) {
          await supabase.from("data_evolution_prix_energie").insert(payload);
        } else {
          await supabase.from("data_evolution_prix_energie").update(payload).eq("id", item.id);
        }
      }
      toast.success("Sauvegardé");
      fetchData();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const energyLabels: Record<string, string> = {
    electricite: "⚡ Électricité",
    gaz: "🔥 Gaz naturel",
    fioul: "🛢️ Fioul domestique",
    propane: "🏭 Propane",
    bois: "🌳 Bois / Granulés",
  };

  return (
    <MobileLayout title="Évolution Prix Énergie" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              Taux d'Augmentation Annuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Ces taux sont utilisés pour projeter les gains sur 10 ans dans les documents PDF (pré-étude et résultat). Sources : CRE, INSEE, historiques 2015-2025.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {data.map((item) => (
                  <div key={item.id} className={`p-3 rounded-lg border ${item.isModified ? "border-primary bg-primary/5" : "border-muted"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {energyLabels[item.type_energie] || item.type_energie}
                        </span>
                        {item.isGlobal ? (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1"><Globe className="h-3 w-3" /> Global</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 bg-orange-50"><User className="h-3 w-3" /> Perso</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={item.actif} onCheckedChange={(checked) => handleChange(item.id, "actif", checked)} disabled={item.isGlobal} />
                        {!item.isGlobal && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type d'énergie</label>
                        <Input value={item.type_energie} onChange={(e) => handleChange(item.id, "type_energie", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Taux annuel (%)</label>
                        <Input type="number" step="0.1" value={item.taux_augmentation_annuel} onChange={(e) => handleChange(item.id, "taux_augmentation_annuel", parseFloat(e.target.value) || 0)} className="h-8 text-xs font-bold text-red-600" disabled={item.isGlobal} />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground">Description / Source</label>
                      <Input value={item.description || ""} onChange={(e) => handleChange(item.id, "description", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                    </div>

                    {/* Mini preview: projection on 10 years */}
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Projection : prix x{(Math.pow(1 + item.taux_augmentation_annuel / 100, 10)).toFixed(2)} en 10 ans
                      ({((Math.pow(1 + item.taux_augmentation_annuel / 100, 10) - 1) * 100).toFixed(0)}% d'augmentation cumulée)
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

export default DataEvolutionPrix;
