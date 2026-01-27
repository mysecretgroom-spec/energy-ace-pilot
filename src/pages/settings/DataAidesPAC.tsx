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
import { Gift, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface AideData {
  id: string;
  code: string;
  nom: string;
  type_aide: string;
  profil_revenus: string | null;
  pac_subtype: string | null;
  montant_fixe: number | null;
  montant_plafond: number | null;
  conditions: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const PROFIL_LABELS: Record<string, string> = {
  tres_modeste: "Très modeste",
  modeste: "Modeste",
  intermediaire: "Intermédiaire",
  superieur: "Supérieur",
};

const DataAidesPAC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AideData[]>([]);
  const [originalData, setOriginalData] = useState<AideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: aideData, error } = await supabase
        .from("data_aides_pac")
        .select("*")
        .order("type_aide", { ascending: true });

      if (error) throw error;
      const formattedData = (aideData || []).map(item => ({
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
    const newItem: AideData = {
      id: `new-${Date.now()}`,
      code: "NOUVELLE_AIDE",
      nom: "Nouvelle aide",
      type_aide: "mpr",
      profil_revenus: null,
      pac_subtype: null,
      montant_fixe: 0,
      montant_plafond: null,
      conditions: "",
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([...data, newItem]);
    setHasChanges(true);
  };

  const handleChange = (id: string, field: keyof AideData, value: any) => {
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
        await supabase.from("data_aides_pac").delete().eq("id", item.id);
      }

      for (const item of modifiedItems) {
        const payload = {
          code: item.code,
          nom: item.nom,
          type_aide: item.type_aide,
          profil_revenus: item.profil_revenus,
          pac_subtype: item.pac_subtype,
          montant_fixe: item.montant_fixe,
          montant_plafond: item.montant_plafond,
          conditions: item.conditions,
          actif: item.actif,
          user_id: user.id,
        };
        if (item.isNew) {
          await supabase.from("data_aides_pac").insert(payload);
        } else {
          await supabase.from("data_aides_pac").update(payload).eq("id", item.id);
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case "mpr": return "bg-purple-100 text-purple-700";
      case "cee": return "bg-green-100 text-green-700";
      case "tva": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <MobileLayout title="Aides & Primes PAC" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              MaPrimeRénov, CEE, TVA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-purple-50 rounded-lg p-3 text-xs text-purple-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Configurez les aides PAC selon le profil de revenus et le type de PAC installée.</p>
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
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1 bg-purple-50"><User className="h-3 w-3" /> Perso</Badge>
                        )}
                        <Badge className={`text-[10px] ${getTypeColor(item.type_aide)}`}>{item.type_aide.toUpperCase()}</Badge>
                        <Switch checked={item.actif} onCheckedChange={(checked) => handleChange(item.id, "actif", checked)} disabled={item.isGlobal} />
                      </div>
                      {!item.isGlobal && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground">Nom de l'aide</label>
                        <Input value={item.nom} onChange={(e) => handleChange(item.id, "nom", e.target.value)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Profil</label>
                        <Select value={item.profil_revenus || "all"} onValueChange={(val) => handleChange(item.id, "profil_revenus", val === "all" ? null : val)} disabled={item.isGlobal}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tous</SelectItem>
                            <SelectItem value="tres_modeste">Très modeste</SelectItem>
                            <SelectItem value="modeste">Modeste</SelectItem>
                            <SelectItem value="intermediaire">Intermédiaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Montant (€)</label>
                        <Input type="number" value={item.montant_fixe || ""} onChange={(e) => handleChange(item.id, "montant_fixe", parseFloat(e.target.value) || null)} className="h-8 text-xs" disabled={item.isGlobal} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Plafond (€)</label>
                        <Input type="number" value={item.montant_plafond || ""} onChange={(e) => handleChange(item.id, "montant_plafond", parseFloat(e.target.value) || null)} className="h-8 text-xs" disabled={item.isGlobal} />
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

export default DataAidesPAC;
