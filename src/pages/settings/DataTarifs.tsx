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
import { Euro, Loader2, Zap, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TarifData {
  id: string;
  type_revente: string;
  puissance_min: number;
  puissance_max: number;
  prix_kwh: number;
  date_effet: string;
  actif: boolean;
}

const typeLabels: Record<string, string> = {
  revente_totale: "Revente totale",
  revente_surplus: "Revente surplus",
  autoconsommation: "Autoconsommation",
};

const DataTarifs = () => {
  const [data, setData] = useState<TarifData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<TarifData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type_revente: "revente_surplus",
    puissance_min: "0",
    puissance_max: "9",
    prix_kwh: "0.13",
    date_effet: new Date().toISOString().split("T")[0],
    actif: true,
  });
  const [saving, setSaving] = useState(false);

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
      setData(tarifData || []);
    } catch (error) {
      console.error("Erreur chargement tarifs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      type_revente: "revente_surplus",
      puissance_min: "0",
      puissance_max: "9",
      prix_kwh: "0.13",
      date_effet: new Date().toISOString().split("T")[0],
      actif: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: TarifData) => {
    setEditItem(item);
    setFormData({
      type_revente: item.type_revente,
      puissance_min: item.puissance_min.toString(),
      puissance_max: item.puissance_max.toString(),
      prix_kwh: item.prix_kwh.toString(),
      date_effet: item.date_effet,
      actif: item.actif,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        type_revente: formData.type_revente,
        puissance_min: parseFloat(formData.puissance_min) || 0,
        puissance_max: parseFloat(formData.puissance_max) || 999,
        prix_kwh: parseFloat(formData.prix_kwh) || 0,
        date_effet: formData.date_effet,
        actif: formData.actif,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_tarifs_revente")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Tarif modifié");
      } else {
        const { error } = await supabase.from("data_tarifs_revente").insert(payload);
        if (error) throw error;
        toast.success("Tarif ajouté");
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
    if (!confirm("Supprimer ce tarif ?")) return;

    try {
      const { error } = await supabase.from("data_tarifs_revente").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tarif supprimé");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
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
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Euro className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs de rachat EDF OA</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prix de rachat du kWh selon le type de contrat et la puissance installée.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button onClick={openAddDialog} className="w-full gap-2">
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
                    <div key={item.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">
                          {item.puissance_min} - {item.puissance_max} kWc
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">
                            {(item.prix_kwh * 100).toFixed(2)} c€/kWh
                          </span>
                          {!item.actif && (
                            <Badge variant="secondary">Inactif</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Depuis le{" "}
                        {format(new Date(item.date_effet), "d MMMM yyyy", {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifier le tarif" : "Ajouter un tarif"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Type de revente</label>
                <Select
                  value={formData.type_revente}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type_revente: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revente_totale">Revente totale</SelectItem>
                    <SelectItem value="revente_surplus">Revente surplus</SelectItem>
                    <SelectItem value="autoconsommation">Autoconsommation</SelectItem>
                  </SelectContent>
                </Select>
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
                <label className="text-sm font-medium">Prix kWh (€)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.prix_kwh}
                  onChange={(e) =>
                    setFormData({ ...formData, prix_kwh: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date d'effet</label>
                <Input
                  type="date"
                  value={formData.date_effet}
                  onChange={(e) =>
                    setFormData({ ...formData, date_effet: e.target.value })
                  }
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

export default DataTarifs;
