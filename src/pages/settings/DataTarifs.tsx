import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Euro, Loader2, Zap, Plus, Trash2, Save, RotateCcw, Globe, User } from "lucide-react";

interface TarifData {
  id: string;
  type_revente: string;
  puissance_min: number;
  puissance_max: number;
  prix_kwh: number;
  date_effet: string;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const typeLabels: Record<string, string> = {
  revente_totale: "Revente totale",
  revente_surplus: "Revente surplus",
  autoconsommation: "Autoconsommation",
};

const DataTarifs = () => {
  const { user } = useAuth();
  const [data, setData] = useState<TarifData[]>([]);
  const [originalData, setOriginalData] = useState<TarifData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tarifData, error } = await supabase
        .from("data_tarifs_revente")
        .select("*")
        .order("type_revente", { ascending: true })
        .order("puissance_min", { ascending: true });

      if (error) throw error;
      const formattedData = (tarifData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement tarifs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: TarifData = {
      id: `new-${Date.now()}`,
      type_revente: "revente_surplus",
      puissance_min: 0,
      puissance_max: 9,
      prix_kwh: 0.13,
      date_effet: new Date().toISOString().split("T")[0],
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof TarifData, value: any) => {
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
    if (!confirm("Supprimer ce tarif ?")) return;
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
    
    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_tarifs_revente").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue;
        
        const payload = {
          type_revente: item.type_revente,
          puissance_min: item.puissance_min,
          puissance_max: item.puissance_max,
          prix_kwh: item.prix_kwh,
          date_effet: item.date_effet,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_tarifs_revente").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_tarifs_revente").update(payload).eq("id", item.id);
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

  // Grouper par type
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.type_revente]) {
      acc[item.type_revente] = [];
    }
    acc[item.type_revente].push(item);
    return acc;
  }, {} as Record<string, TarifData[]>);

  return (
    <MobileLayout title="Tarifs revente" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Euro className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs de rachat EDF OA</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un tarif
        </Button>

        {/* Liste par type */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun tarif configuré</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedData).map(([type, items]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  {typeLabels[type] || type}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className={`p-3 space-y-2 ${item.isModified ? "bg-amber-500/5" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={item.type_revente}
                          onValueChange={(v) => handleFieldChange(item.id, "type_revente", v)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="revente_totale">Revente totale</SelectItem>
                            <SelectItem value="revente_surplus">Revente surplus</SelectItem>
                            <SelectItem value="autoconsommation">Autoconsommation</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={item.puissance_min}
                            onChange={(e) => handleFieldChange(item.id, "puissance_min", parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-xs"
                            placeholder="Min"
                          />
                          <span className="text-xs">-</span>
                          <Input
                            type="number"
                            step="0.1"
                            value={item.puissance_max}
                            onChange={(e) => handleFieldChange(item.id, "puissance_max", parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-xs"
                            placeholder="Max"
                          />
                          <span className="text-xs text-muted-foreground">kWc</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.001"
                            value={item.prix_kwh}
                            onChange={(e) => handleFieldChange(item.id, "prix_kwh", parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">€/kWh</span>
                        </div>
                        {item.isNew && <Badge className="bg-green-500 text-xs">Nouveau</Badge>}
                        {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Modifié</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="date"
                          value={item.date_effet}
                          onChange={(e) => handleFieldChange(item.id, "date_effet", e.target.value)}
                          className="w-36 h-8 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Actif</span>
                          <Switch
                            checked={item.actif}
                            onCheckedChange={(c) => handleFieldChange(item.id, "actif", c)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive ml-auto"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Fixed bottom bar with save button */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3 z-50 transition-all duration-300 ease-out ${
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

export default DataTarifs;
