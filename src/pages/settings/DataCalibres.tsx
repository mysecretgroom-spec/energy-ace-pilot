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
import { Gauge, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User } from "lucide-react";

interface CalibreData {
  id: string;
  calibre_amperes: number;
  puissance_kva: number;
  intensite_max_a: number;
  usage_typique: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const DataCalibres = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CalibreData[]>([]);
  const [originalData, setOriginalData] = useState<CalibreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: calibreData, error } = await supabase
        .from("data_calibres")
        .select("*")
        .order("calibre_amperes", { ascending: true });

      if (error) throw error;
      const formattedData = (calibreData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement calibres:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: CalibreData = {
      id: `new-${Date.now()}`,
      calibre_amperes: 15,
      puissance_kva: 3,
      intensite_max_a: 15,
      usage_typique: null,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof CalibreData, value: any) => {
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
    if (item?.isGlobal && !item.isNew) {
      toast.error("Impossible de supprimer les données globales");
      return;
    }
    if (!confirm("Supprimer ce calibre ?")) return;
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    const invalidItems = data.filter(item => !item.isGlobal && (!item.calibre_amperes || !item.puissance_kva));
    if (invalidItems.length > 0) {
      toast.error("Calibre et puissance sont obligatoires");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_calibres").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue;
        
        const payload = {
          calibre_amperes: item.calibre_amperes,
          puissance_kva: item.puissance_kva,
          intensite_max_a: item.intensite_max_a || item.calibre_amperes,
          usage_typique: item.usage_typique,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_calibres").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_calibres").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      toast.success("Modifications enregistrées");
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Calibres disjoncteur" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Gauge className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Calibres de disjoncteur</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un calibre
        </Button>

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Calibres</span>
              <Badge variant="secondary">{data.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun calibre configuré</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 space-y-2 ${item.isModified ? "bg-amber-500/5" : ""}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.calibre_amperes}
                          onChange={(e) => handleFieldChange(item.id, "calibre_amperes", parseInt(e.target.value) || 0)}
                          className="h-8 text-sm w-16"
                        />
                        <span className="text-sm text-muted-foreground">A</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          value={item.puissance_kva}
                          onChange={(e) => handleFieldChange(item.id, "puissance_kva", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm w-16"
                        />
                        <span className="text-sm text-muted-foreground">kVA</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Max:</span>
                        <Input
                          type="number"
                          value={item.intensite_max_a}
                          onChange={(e) => handleFieldChange(item.id, "intensite_max_a", parseInt(e.target.value) || 0)}
                          className="h-8 text-sm w-16"
                        />
                        <span className="text-sm text-muted-foreground">A</span>
                      </div>
                      {item.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      <div className="flex items-center gap-2 ml-auto">
                        <Switch
                          checked={item.actif}
                          onCheckedChange={(c) => handleFieldChange(item.id, "actif", c)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={item.usage_typique || ""}
                      onChange={(e) => handleFieldChange(item.id, "usage_typique", e.target.value || null)}
                      className="h-8 text-xs"
                      placeholder="Usage typique (ex: Maison standard avec...)"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom bar with save button */}
      <div 
        className={`fixed bottom-[5.5rem] left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3 z-40 transition-all duration-300 ease-out ${
          hasChanges 
            ? "translate-y-0 opacity-100" 
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4" />
          Annuler
        </Button>
        <Button
          className="flex-1 gap-2 bg-gradient-hero"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </MobileLayout>
  );
};

export default DataCalibres;
