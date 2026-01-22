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
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Zap, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface CompteurData {
  id: string;
  type_compteur: string;
  montant: number;
  description: string | null;
  actif: boolean;
}

const DataCompteurs = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<CompteurData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CompteurData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type_compteur: "",
    montant: "",
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
      const { data: compteurData, error } = await supabase
        .from("data_compteurs")
        .select("*")
        .order("type_compteur", { ascending: true });

      if (error) throw error;
      setData(compteurData || []);
    } catch (error) {
      console.error("Erreur chargement compteurs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      type_compteur: "",
      montant: "0",
      description: "",
      actif: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CompteurData) => {
    setEditItem(item);
    setFormData({
      type_compteur: item.type_compteur,
      montant: item.montant.toString(),
      description: item.description || "",
      actif: item.actif,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.type_compteur) {
      toast.error("Veuillez remplir le type de compteur");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type_compteur: formData.type_compteur.toUpperCase(),
        montant: parseFloat(formData.montant) || 0,
        description: formData.description || null,
        actif: formData.actif,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_compteurs")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Type de compteur modifié");
      } else {
        const { error } = await supabase.from("data_compteurs").insert(payload);
        if (error) throw error;
        toast.success("Type de compteur ajouté");
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
    if (!confirm("Supprimer ce type de compteur ?")) return;

    try {
      const { error } = await supabase.from("data_compteurs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Type de compteur supprimé");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  return (
    <MobileLayout title="Types de compteurs" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Types de compteurs</p>
              <p className="text-xs text-muted-foreground mt-1">
                Définissez les types de compteurs (monophasé, triphasé) avec leurs surcoûts éventuels.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions admin */}
        {isAdmin && (
          <Button onClick={openAddDialog} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un type
          </Button>
        )}

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Types de compteurs</span>
              <Badge variant="secondary">{data.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading || roleLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : data.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">Aucun type configuré</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.type_compteur}</span>
                        {!item.actif && (
                          <Badge variant="secondary" className="text-xs">Inactif</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <p className="font-bold text-primary">
                          {item.montant.toLocaleString()} €
                        </p>
                      </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog d'édition */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifier le type" : "Ajouter un type"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Type de compteur</label>
                <Input
                  value={formData.type_compteur}
                  onChange={(e) =>
                    setFormData({ ...formData, type_compteur: e.target.value })
                  }
                  placeholder="MONOPHASÉ, TRIPHASÉ..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Montant (€)</label>
                <Input
                  type="number"
                  value={formData.montant}
                  onChange={(e) =>
                    setFormData({ ...formData, montant: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description optionnelle..."
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Actif</label>
                <Switch
                  checked={formData.actif}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, actif: checked })
                  }
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

export default DataCompteurs;
