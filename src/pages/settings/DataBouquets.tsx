import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, Loader2, Package, Plus, Trash2, Save, RotateCcw } from "lucide-react";

interface BouquetData {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  description: string | null;
  actif: boolean;
  isNew?: boolean;
  isModified?: boolean;
}

const DataBouquets = () => {
  const [data, setData] = useState<BouquetData[]>([]);
  const [originalData, setOriginalData] = useState<BouquetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bouquetData, error } = await supabase
        .from("data_prix_bouquets")
        .select("*")
        .order("puissance_kwc", { ascending: true });

      if (error) throw error;
      const formattedData = (bouquetData || []).map(item => ({
        ...item,
        isNew: false,
        isModified: false,
      }));
      setData(formattedData);
      setOriginalData(JSON.parse(JSON.stringify(formattedData)));
      setHasChanges(false);
    } catch (error) {
      console.error("Erreur chargement bouquets:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newItem: BouquetData = {
      id: `new-${Date.now()}`,
      nom_bouquet: "Nouveau bouquet",
      puissance_kwc: 3,
      prix_recommande: 10000,
      prix_max: 12000,
      description: null,
      actif: true,
      isNew: true,
      isModified: true,
    };
    setData([newItem, ...data]);
    setHasChanges(true);
  };

  const handleFieldChange = (id: string, field: keyof BouquetData, value: any) => {
    setData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value, isModified: true };
      }
      return item;
    }));
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Supprimer ce bouquet ?")) return;
    setData(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setData(JSON.parse(JSON.stringify(originalData)));
    setHasChanges(false);
  };

  const handleSave = async () => {
    const invalidItems = data.filter(item => !item.nom_bouquet);
    if (invalidItems.length > 0) {
      toast.error("Le nom est obligatoire pour tous les bouquets");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(data.filter(d => !d.isNew).map(d => d.id));
      const toDelete = originalData.filter(o => !currentIds.has(o.id));

      for (const item of toDelete) {
        const { error } = await supabase.from("data_prix_bouquets").delete().eq("id", item.id);
        if (error) throw error;
      }

      for (const item of data) {
        const payload = {
          nom_bouquet: item.nom_bouquet,
          puissance_kwc: item.puissance_kwc,
          prix_recommande: item.prix_recommande,
          prix_max: item.prix_max,
          description: item.description,
          actif: item.actif,
        };

        if (item.isNew) {
          const { error } = await supabase.from("data_prix_bouquets").insert(payload);
          if (error) throw error;
        } else if (item.isModified) {
          const { error } = await supabase.from("data_prix_bouquets").update(payload).eq("id", item.id);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <MobileLayout title="Prix bouquets" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs installations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez directement les valeurs puis cliquez sur "Enregistrer".
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={handleAddNew} variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un bouquet
        </Button>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun bouquet configuré</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <Card key={item.id} className={`transition-all ${item.isModified ? "border-amber-500/50 bg-amber-500/5" : ""} ${!item.actif ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={item.nom_bouquet}
                        onChange={(e) => handleFieldChange(item.id, "nom_bouquet", e.target.value)}
                        className="h-8 font-medium text-sm flex-1"
                        placeholder="Nom du bouquet"
                      />
                      {item.isNew && <Badge className="bg-green-500">Nouveau</Badge>}
                      {item.isModified && !item.isNew && <Badge variant="outline" className="border-amber-500 text-amber-600">Modifié</Badge>}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
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
                      <label className="text-xs text-muted-foreground">Puissance</label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.5"
                          value={item.puissance_kwc}
                          onChange={(e) => handleFieldChange(item.id, "puissance_kwc", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">kWc</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Prix reco.</label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.prix_recommande}
                          onChange={(e) => handleFieldChange(item.id, "prix_recommande", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">€</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Prix max</label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.prix_max}
                          onChange={(e) => handleFieldChange(item.id, "prix_max", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">€</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Textarea
                      value={item.description || ""}
                      onChange={(e) => handleFieldChange(item.id, "description", e.target.value || null)}
                      className="text-xs min-h-[60px]"
                      placeholder="Description optionnelle..."
                    />
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

export default DataBouquets;
