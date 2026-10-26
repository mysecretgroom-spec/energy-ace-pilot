import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Calculator, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoeffData {
  id: string;
  categorie: string;
  code: string;
  label: string;
  valeur: number;
  unite: string;
  description: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const CATEGORIES = [
  { key: "ecs", label: "Eau Chaude Sanitaire (ECS)", description: "Consommation ECS par personne et par an" },
  { key: "base_elec", label: "Électricité de base", description: "Consommation électrique hors chauffage et ECS" },
  { key: "appareil", label: "Appareils énergivores", description: "Coefficients de calcul pour piscine, VE, sauna, etc." },
];

const DataEstimateurCoefficients = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CoeffData[]>([]);
  const [originalData, setOriginalData] = useState<CoeffData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(["ecs", "base_elec", "appareil"]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: coeffData, error } = await supabase
        .from("data_estimateur_coefficients")
        .select("*")
        .order("categorie")
        .order("code");
      if (error) throw error;
      const formatted = (coeffData || []).map(item => ({
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

  const handleChange = (id: string, field: keyof CoeffData, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value, isModified: true } : item));
    setHasChanges(true);
  };

  const handleAddNew = (categorie: string) => {
    if (!user) return;
    const newItem: CoeffData = {
      id: `new-${Date.now()}`,
      categorie,
      code: "",
      label: "",
      valeur: 0,
      unite: "kWh",
      description: "",
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData(prev => [...prev, newItem]);
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    const item = data.find(d => d.id === id);
    if (item?.isGlobal) { toast.error("Impossible de supprimer une donnée globale"); return; }
    setData(prev => prev.filter(d => d.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => { setData(JSON.parse(JSON.stringify(originalData))); setHasChanges(false); };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const modified = data.filter(item => item.isModified && !item.isGlobal);
      const deleted = originalData.filter(orig => !data.some(d => d.id === orig.id) && !orig.isGlobal);

      for (const item of deleted) {
        await supabase.from("data_estimateur_coefficients").delete().eq("id", item.id);
      }
      for (const item of modified) {
        const payload = {
          categorie: item.categorie,
          code: item.code,
          label: item.label,
          valeur: item.valeur,
          unite: item.unite,
          description: item.description,
          actif: item.actif,
          user_id: user.id,
        };
        if (item.isNew) {
          await supabase.from("data_estimateur_coefficients").insert(payload);
        } else {
          await supabase.from("data_estimateur_coefficients").update(payload).eq("id", item.id);
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

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <MobileLayout title="Coefficients Estimateur" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Paramètres de l'estimateur de consommation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-primary/5 rounded-lg p-3 text-xs text-primary mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Ces coefficients alimentent l'outil d'estimation de consommation énergétique dans les études. Les prix des énergies et les niveaux d'isolation sont gérés dans leurs tables respectives.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                {CATEGORIES.map(cat => {
                  const items = data.filter(d => d.categorie === cat.key);
                  const isOpen = openCategories.includes(cat.key);
                  return (
                    <Collapsible key={cat.key} open={isOpen} onOpenChange={() => toggleCategory(cat.key)}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="text-left">
                            <p className="text-sm font-medium">{cat.label}</p>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{items.length}</Badge>
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {items.map(item => (
                          <div key={item.id} className={cn("p-3 rounded-lg border", item.isModified ? "border-primary bg-primary/5" : "border-muted")}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {item.isGlobal ? (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Global</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 bg-primary/10"><User className="h-3 w-3" /> Perso</Badge>
                                )}
                                <span className="text-xs font-medium">{item.label || item.code}</span>
                                <Switch checked={item.actif} onCheckedChange={v => handleChange(item.id, "actif", v)} disabled={item.isGlobal} />
                              </div>
                              {!item.isGlobal && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Valeur</label>
                                <Input
                                  type="number"
                                  step="any"
                                  value={item.valeur}
                                  onChange={e => handleChange(item.id, "valeur", parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs"
                                  disabled={item.isGlobal}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Unité</label>
                                <Input
                                  value={item.unite}
                                  onChange={e => handleChange(item.id, "unite", e.target.value)}
                                  className="h-8 text-xs"
                                  disabled={item.isGlobal}
                                />
                              </div>
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full" onClick={() => handleAddNew(cat.key)}>
                          <Plus className="h-4 w-4 mr-1" /> Ajouter un coefficient
                        </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-[5.5rem] left-0 right-0 p-4 bg-background border-t z-40">
          <div className="flex gap-2 max-w-lg mx-auto">
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

export default DataEstimateurCoefficients;
