import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

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
}

const typeCalculLabels: Record<string, string> = {
  par_kwc: "€/kWc",
  pourcentage: "%",
  fixe: "€ fixe",
};

const DataAides = () => {
  const [data, setData] = useState<AideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<AideData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    nom: "",
    description: "",
    type_calcul: "par_kwc",
    valeur: "0",
    puissance_min: "0",
    puissance_max: "9",
    conditions: "",
    actif: true,
  });
  const [saving, setSaving] = useState(false);

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
      setData(aidesData || []);
    } catch (error) {
      console.error("Erreur chargement aides:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      code: "",
      nom: "",
      description: "",
      type_calcul: "par_kwc",
      valeur: "0",
      puissance_min: "0",
      puissance_max: "9",
      conditions: "",
      actif: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: AideData) => {
    setEditItem(item);
    setFormData({
      code: item.code,
      nom: item.nom,
      description: item.description || "",
      type_calcul: item.type_calcul,
      valeur: item.valeur.toString(),
      puissance_min: item.puissance_min.toString(),
      puissance_max: item.puissance_max.toString(),
      conditions: item.conditions || "",
      actif: item.actif,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.nom) {
      toast.error("Code et nom requis");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code,
        nom: formData.nom,
        description: formData.description || null,
        type_calcul: formData.type_calcul,
        valeur: parseFloat(formData.valeur) || 0,
        puissance_min: parseFloat(formData.puissance_min) || 0,
        puissance_max: parseFloat(formData.puissance_max) || 999,
        conditions: formData.conditions || null,
        actif: formData.actif,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_aides")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Aide modifiée");
      } else {
        const { error } = await supabase.from("data_aides").insert(payload);
        if (error) throw error;
        toast.success("Aide ajoutée");
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette aide ?")) return;

    try {
      const { error } = await supabase.from("data_aides").delete().eq("id", id);
      if (error) throw error;
      toast.success("Aide supprimée");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  return (
    <MobileLayout title="Aides & Primes" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Gift className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Aides et primes</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configurez les primes autoconsommation, éco TVA et autres aides applicables aux études.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={openAddDialog} className="w-full gap-2">
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
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{item.nom}</span>
                        {!item.actif && (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </div>
                      <p className="text-sm text-green-600 font-bold">
                        {item.valeur} {typeCalculLabels[item.type_calcul] || item.type_calcul}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.puissance_min} - {item.puissance_max} kWc
                      </p>
                      {item.conditions && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.conditions}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifier l'aide" : "Ajouter une aide"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code</label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="prime_autoconso"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nom</label>
                  <Input
                    value={formData.nom}
                    onChange={(e) =>
                      setFormData({ ...formData, nom: e.target.value })
                    }
                    placeholder="Prime autoconsommation"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description de l'aide"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type de calcul</label>
                  <Select
                    value={formData.type_calcul}
                    onValueChange={(v) =>
                      setFormData({ ...formData, type_calcul: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="par_kwc">€ par kWc</SelectItem>
                      <SelectItem value="pourcentage">Pourcentage</SelectItem>
                      <SelectItem value="fixe">Montant fixe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Valeur</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valeur}
                    onChange={(e) =>
                      setFormData({ ...formData, valeur: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Puissance min (kWc)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.puissance_min}
                    onChange={(e) =>
                      setFormData({ ...formData, puissance_min: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Puissance max (kWc)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.puissance_max}
                    onChange={(e) =>
                      setFormData({ ...formData, puissance_max: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Conditions</label>
                <Input
                  value={formData.conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, conditions: e.target.value })
                  }
                  placeholder="Conditions d'éligibilité"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Actif</label>
                <Switch
                  checked={formData.actif}
                  onCheckedChange={(c) => setFormData({ ...formData, actif: c })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editItem ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
};

export default DataAides;
