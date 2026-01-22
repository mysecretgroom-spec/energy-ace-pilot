import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Calculator, Loader2, Package, Plus, Pencil, Trash2 } from "lucide-react";

interface BouquetData {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  description: string | null;
  actif: boolean;
}

const DataBouquets = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<BouquetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<BouquetData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nom_bouquet: "",
    puissance_kwc: "",
    prix_recommande: "",
    prix_max: "",
    description: "",
    actif: true,
  });
  const [saving, setSaving] = useState(false);

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
      setData(bouquetData || []);
    } catch (error) {
      console.error("Erreur chargement bouquets:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      nom_bouquet: "",
      puissance_kwc: "3",
      prix_recommande: "10000",
      prix_max: "12000",
      description: "",
      actif: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: BouquetData) => {
    setEditItem(item);
    setFormData({
      nom_bouquet: item.nom_bouquet,
      puissance_kwc: item.puissance_kwc.toString(),
      prix_recommande: item.prix_recommande.toString(),
      prix_max: item.prix_max.toString(),
      description: item.description || "",
      actif: item.actif,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nom_bouquet) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nom_bouquet: formData.nom_bouquet,
        puissance_kwc: parseFloat(formData.puissance_kwc) || 0,
        prix_recommande: parseFloat(formData.prix_recommande) || 0,
        prix_max: parseFloat(formData.prix_max) || 0,
        description: formData.description || null,
        actif: formData.actif,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_prix_bouquets")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Bouquet modifié");
      } else {
        const { error } = await supabase.from("data_prix_bouquets").insert(payload);
        if (error) throw error;
        toast.success("Bouquet ajouté");
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
    if (!confirm("Supprimer ce bouquet ?")) return;

    try {
      const { error } = await supabase.from("data_prix_bouquets").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bouquet supprimé");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
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
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tarifs installations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Prix des installations selon la puissance. Le prix recommandé est
                la base de calcul, le prix max est le plafond autorisé.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions admin */}
        {isAdmin && (
          <Button onClick={openAddDialog} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un bouquet
          </Button>
        )}

        {/* Liste */}
        {loading || roleLoading ? (
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
              <Card key={item.id} className={!item.actif ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.nom_bouquet}</h3>
                        {!item.actif && <Badge variant="secondary">Inactif</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.puissance_kwc} kWc
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-lg font-bold">
                        {item.puissance_kwc} kWc
                      </Badge>
                      {isAdmin && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Prix recommandé</p>
                      <p className="font-bold text-primary">
                        {formatCurrency(item.prix_recommande)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prix maximum</p>
                      <p className="font-bold text-amber-600">
                        {formatCurrency(item.prix_max)}
                      </p>
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
                {editItem ? "Modifier le bouquet" : "Ajouter un bouquet"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nom du bouquet</label>
                <Input
                  value={formData.nom_bouquet}
                  onChange={(e) =>
                    setFormData({ ...formData, nom_bouquet: e.target.value })
                  }
                  placeholder="Starter 3kWc..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Puissance (kWc)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.puissance_kwc}
                  onChange={(e) =>
                    setFormData({ ...formData, puissance_kwc: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Prix recommandé (€)</label>
                  <Input
                    type="number"
                    value={formData.prix_recommande}
                    onChange={(e) =>
                      setFormData({ ...formData, prix_recommande: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prix max (€)</label>
                  <Input
                    type="number"
                    value={formData.prix_max}
                    onChange={(e) =>
                      setFormData({ ...formData, prix_max: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description optionnelle..."
                  rows={2}
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

export default DataBouquets;
