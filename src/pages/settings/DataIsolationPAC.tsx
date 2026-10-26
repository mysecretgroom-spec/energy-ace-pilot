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
import { Shield, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User, Info } from "lucide-react";

interface IsolationData {
  id: string;
  niveau_isolation: string;
  label: string;
  coefficient_deperdition: number;
  besoins_kwh_m2_an: number;
  description: string | null;
  ordre: number;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataIsolationPAC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<IsolationData[]>([]);
  const [originalData, setOriginalData] = useState<IsolationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: isolationData, error } = await supabase
        .from("data_pac_isolation")
        .select("*")
        .order("ordre", { ascending: true });

      if (error) throw error;
      const formattedData = (isolationData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement isolation:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const maxOrdre = data.reduce((max, item) => Math.max(max, item.ordre || 0), 0);
    const newItem: IsolationData = {
      id: `new-${Date.now()}`,
      niveau_isolation: `custom_${Date.now()}`,
      label: "Nouveau niveau",
      coefficient_deperdition: 1.0,
      besoins_kwh_m2_an: 100,
      description: "",
      ordre: maxOrdre + 1,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([...data, newItem]);
    setHasChanges(true);
  };

  const handleChange = (id: string, field: keyof IsolationData, value: any) => {
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

      // Supprimer les éléments supprimés
      for (const item of deletedItems) {
        await supabase.from("data_pac_isolation").delete().eq("id", item.id);
      }

      // Insérer ou mettre à jour les éléments modifiés
      for (const item of modifiedItems) {
        const payload = {
          niveau_isolation: item.niveau_isolation,
          label: item.label,
          coefficient_deperdition: item.coefficient_deperdition,
          besoins_kwh_m2_an: item.besoins_kwh_m2_an,
          description: item.description,
          ordre: item.ordre,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          await supabase.from("data_pac_isolation").insert(payload);
        } else {
          await supabase.from("data_pac_isolation").update(payload).eq("id", item.id);
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

  return (
    <MobileLayout title="Niveaux d'Isolation PAC" showBackButton>
      <div className="p-4 pb-24 space-y-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Coefficients d'Isolation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 mb-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Ces niveaux d'isolation sont utilisés pour calculer automatiquement les besoins en chauffage
                et les économies potentielles lors d'une étude PAC.
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
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Globe className="h-3 w-3" /> Global
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50">
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

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Label</label>
                        <Input
                          value={item.label}
                          onChange={(e) => handleChange(item.id, "label", e.target.value)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Code</label>
                        <Input
                          value={item.niveau_isolation}
                          onChange={(e) => handleChange(item.id, "niveau_isolation", e.target.value)}
                          className="h-8 text-xs font-mono"
                          disabled={item.isGlobal}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Déperdition (W/m².K)</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={item.coefficient_deperdition}
                          onChange={(e) => handleChange(item.id, "coefficient_deperdition", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Besoins (kWh/m²/an)</label>
                        <Input
                          type="number"
                          value={item.besoins_kwh_m2_an}
                          onChange={(e) => handleChange(item.id, "besoins_kwh_m2_an", parseInt(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ordre</label>
                        <Input
                          type="number"
                          value={item.ordre}
                          onChange={(e) => handleChange(item.id, "ordre", parseInt(e.target.value) || 0)}
                          className="h-8 text-xs"
                          disabled={item.isGlobal}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Input
                        value={item.description || ""}
                        onChange={(e) => handleChange(item.id, "description", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Description du niveau..."
                        disabled={item.isGlobal}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions fixes en bas */}
        <div className="fixed bottom-[5.5rem] left-0 right-0 p-4 bg-background border-t z-40">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button variant="outline" className="flex-1" onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex-1"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default DataIsolationPAC;
