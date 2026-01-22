import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Loader2, Plus, Trash2, Save, RotateCcw } from "lucide-react";

interface FinancementData {
  id: string;
  nom: string;
  taux_effectif: number;
  taeg: number;
  duree_mois: number;
  actif: boolean;
  isNew?: boolean;
  isModified?: boolean;
}

const DataFinancements = () => {
  const [data, setData] = useState<FinancementData[]>([]);
  const [originalData, setOriginalData] = useState<FinancementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: financementsData, error } = await supabase
        .from("data_financements")
        .select("*")
        .order("duree_mois", { ascending: true });

      if (error) throw error;
      const formattedData = (financementsData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement financements:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newItem: FinancementData = {
      id: `new-${Date.now()}`,
      nom: "Nouveau financement",
      taux_effectif: 0,
      taeg: 0,
      duree_mois: 180,
      actif: true,
      isNew: true,
      isModified: true,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof FinancementData, value: any) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value, isModified: true };
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Supprimer ce financement ?")) return;
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    // Validate
    const invalidItems = data.filter(item => !item.nom);
    if (invalidItems.length > 0) {
      toast.error("Le nom est requis pour tous les financements");
      return;
    }

    setSaving(true);
    try {
      // Find items to delete (in original but not in current)
      const currentIds = new Set(data.filter(d => !d.isNew).map(d => d.id));
      const toDelete = originalData.filter(o => !currentIds.has(o.id));

      // Delete removed items
      for (const item of toDelete) {
        const { error } = await supabase.from("data_financements").delete().eq("id", item.id);
        if (error) throw error;
      }

      // Upsert all current items
      for (const item of data) {
        const payload = {
          nom: item.nom,
          taux_effectif: item.taux_effectif,
          taeg: item.taeg,
          duree_mois: item.duree_mois,
          actif: item.actif,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_financements").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_financements").update(payload).eq("id", item.id);
          if (error) throw error;
        }
      }

      toast.success("Modifications enregistrées");
      fetchData(); // Reload to get fresh data
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Financements" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Options de financement</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configurez les offres de financement disponibles pour les études.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un financement
        </Button>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun financement configuré</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <Card key={item.id} className={`transition-all ${item.isModified ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.nom}
                        onChange={(e) => handleFieldChange(item.id, "nom", e.target.value)}
                        className="h-8 font-medium text-sm w-48"
                        placeholder="Nom du financement"
                      />
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
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Taux effectif (%)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.taux_effectif}
                        onChange={(e) => handleFieldChange(item.id, "taux_effectif", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">TAEG (%)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.taeg}
                        onChange={(e) => handleFieldChange(item.id, "taeg", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Durée (mois)</label>
                      <Input
                        type="number"
                        value={item.duree_mois}
                        onChange={(e) => handleFieldChange(item.id, "duree_mois", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom bar with save button */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 flex gap-3 z-50">
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
      )}
    </MobileLayout>
  );
};

export default DataFinancements;
