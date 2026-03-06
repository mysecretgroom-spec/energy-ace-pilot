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
import { Gift, Loader2, Plus, Trash2, Save, RotateCcw, Globe, User } from "lucide-react";

interface AideData {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  type_calcul: string;
  valeur: number;
  puissance_min: number;
  puissance_max: number;
  conditions: string | null;
  actif: boolean;
  user_id: string | null;
  isNew?: boolean;
  isModified?: boolean;
  isGlobal?: boolean;
}

const typeCalculLabels: Record<string, string> = {
  par_kwc: "€/kWc",
  pourcentage: "%",
  fixe: "€ fixe",
};

const DataAides = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AideData[]>([]);
  const [originalData, setOriginalData] = useState<AideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: aidesData, error } = await supabase
        .from("data_aides")
        .select("*")
        .order("nom", { ascending: true });

      if (error) throw error;
      const formattedData = (aidesData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
        isGlobal: item.user_id === null,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement aides:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    if (!user) return;
    const newItem: AideData = {
      id: `new-${Date.now()}`,
      code: "",
      nom: "Nouvelle aide",
      description: null,
      type_calcul: "par_kwc",
      valeur: 0,
      puissance_min: 0,
      puissance_max: 999,
      conditions: null,
      actif: true,
      user_id: user.id,
      isNew: true,
      isModified: true,
      isGlobal: false,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof AideData, value: any) => {
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
    if (!confirm("Supprimer cette aide ?")) return;
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
    
    // Validate only user items
    const invalidItems = data.filter(item => !item.isGlobal && (!item.code || !item.nom));
    if (invalidItems.length > 0) {
      toast.error("Code et nom requis pour toutes les aides");
      return;
    }

    setSaving(true);
    try {
      // Find user items to delete (not global)
      const currentIds = new Set(data.filter(d => !d.isNew && !d.isGlobal).map(d => d.id));
      const toDelete = originalData.filter(o => !o.isGlobal && !currentIds.has(o.id));

      // Delete removed user items
      for (const item of toDelete) {
        const { error } = await supabase.from("data_aides").delete().eq("id", item.id);
        if (error) throw error;
      }

      // Insert/Update user items only
      for (const item of data) {
        if (item.isGlobal && !item.isNew) continue; // Skip global items
        
        const payload = {
          code: item.code,
          nom: item.nom,
          description: item.description,
          type_calcul: item.type_calcul,
          valeur: item.valeur,
          puissance_min: item.puissance_min,
          puissance_max: item.puissance_max,
          conditions: item.conditions,
          actif: item.actif,
          user_id: user.id,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_aides").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_aides").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      // Silent save
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Aides & Primes" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Aides et primes</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une aide
        </Button>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune aide configurée</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <Card key={item.id} className={`transition-all ${item.isModified ? "border-amber-500/50 bg-amber-500/5" : ""} ${item.isGlobal ? "border-blue-500/30" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.nom}
                        onChange={(e) => handleFieldChange(item.id, "nom", e.target.value)}
                        className="h-8 font-medium text-sm w-40"
                        placeholder="Nom de l'aide"
                        disabled={item.isGlobal && !item.isNew}
                      />
                      {item.isGlobal && !item.isNew && <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1"><Globe className="h-3 w-3" />Global</Badge>}
                      {!item.isGlobal && !item.isNew && <Badge variant="outline" className="border-green-500 text-green-600 gap-1"><User className="h-3 w-3" />Perso</Badge>}
                      {item.isNew && <Badge className="bg-green-500">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600">Modifié</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Code</label>
                      <Input
                        value={item.code}
                        onChange={(e) => handleFieldChange(item.id, "code", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="ex: prime_autoconso"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Type de calcul</label>
                      <Select
                        value={item.type_calcul}
                        onValueChange={(v) => handleFieldChange(item.id, "type_calcul", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="par_kwc">€ par kWc</SelectItem>
                          <SelectItem value="pourcentage">Pourcentage %</SelectItem>
                          <SelectItem value="fixe">Montant fixe €</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Valeur</label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.valeur}
                          onChange={(e) => handleFieldChange(item.id, "valeur", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">{typeCalculLabels[item.type_calcul]}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Min kWc</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={item.puissance_min}
                        onChange={(e) => handleFieldChange(item.id, "puissance_min", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max kWc</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={item.puissance_max}
                        onChange={(e) => handleFieldChange(item.id, "puissance_max", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Conditions</label>
                    <Input
                      value={item.conditions || ""}
                      onChange={(e) => handleFieldChange(item.id, "conditions", e.target.value || null)}
                      className="h-8 text-xs"
                      placeholder="Conditions d'éligibilité"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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

export default DataAides;
