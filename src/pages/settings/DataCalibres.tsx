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
import { Gauge, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface CalibreData {
  id: string;
  calibre_amperes: number;
  puissance_kva: number;
  intensite_max_a: number;
  usage_typique: string | null;
  actif: boolean;
}

const DataCalibres = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<CalibreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CalibreData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    calibre_amperes: "",
    puissance_kva: "",
    intensite_max_a: "",
    usage_typique: "",
    actif: true,
  });
  const [saving, setSaving] = useState(false);

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
      setData(calibreData || []);
    } catch (error) {
      console.error("Erreur chargement calibres:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      calibre_amperes: "",
      puissance_kva: "",
      intensite_max_a: "",
      usage_typique: "",
      actif: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CalibreData) => {
    setEditItem(item);
    setFormData({
      calibre_amperes: item.calibre_amperes.toString(),
      puissance_kva: item.puissance_kva.toString(),
      intensite_max_a: item.intensite_max_a.toString(),
      usage_typique: item.usage_typique || "",
      actif: item.actif,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.calibre_amperes || !formData.puissance_kva) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    setSaving(true);
    try {
      const calibre = parseInt(formData.calibre_amperes);
      const payload = {
        calibre_amperes: calibre,
        puissance_kva: parseFloat(formData.puissance_kva),
        intensite_max_a: parseInt(formData.intensite_max_a) || calibre,
        usage_typique: formData.usage_typique || null,
        actif: formData.actif,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_calibres")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Calibre modifié");
      } else {
        const { error } = await supabase.from("data_calibres").insert(payload);
        if (error) throw error;
        toast.success("Calibre ajouté");
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
    if (!confirm("Supprimer ce calibre ?")) return;

    try {
      const { error } = await supabase.from("data_calibres").delete().eq("id", id);
      if (error) throw error;
      toast.success("Calibre supprimé");
      fetchData();
    } catch (error: any) {
      console.error("Erreur suppression:", error);
      toast.error(error.message || "Erreur lors de la suppression");
    }
  };

  return (
    <MobileLayout title="Calibres disjoncteur" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Gauge className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Calibres de disjoncteur</p>
              <p className="text-xs text-muted-foreground mt-1">
                Correspondance entre calibre (A), puissance d'abonnement (kVA) et usage typique.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions admin */}
        {isAdmin && (
          <Button onClick={openAddDialog} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un calibre
          </Button>
        )}

        {/* Liste */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Calibres</span>
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
                <p className="text-sm">Aucun calibre configuré</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-base px-3 py-1">
                          {item.calibre_amperes} A
                        </Badge>
                        <div>
                          <p className="font-bold text-primary">{item.puissance_kva} kVA</p>
                          <p className="text-xs text-muted-foreground">Max: {item.intensite_max_a} A</p>
                        </div>
                        {!item.actif && (
                          <Badge variant="secondary" className="text-xs">Inactif</Badge>
                        )}
                      </div>
                      {isAdmin && (
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
                      )}
                    </div>
                    {item.usage_typique && (
                      <p className="text-xs text-muted-foreground pl-1">
                        {item.usage_typique}
                      </p>
                    )}
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
                {editItem ? "Modifier le calibre" : "Ajouter un calibre"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Calibre (A)</label>
                  <Input
                    type="number"
                    value={formData.calibre_amperes}
                    onChange={(e) =>
                      setFormData({ ...formData, calibre_amperes: e.target.value })
                    }
                    placeholder="15, 30, 45..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Puissance (kVA)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.puissance_kva}
                    onChange={(e) =>
                      setFormData({ ...formData, puissance_kva: e.target.value })
                    }
                    placeholder="3, 6, 9..."
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Intensité max (A)</label>
                <Input
                  type="number"
                  value={formData.intensite_max_a}
                  onChange={(e) =>
                    setFormData({ ...formData, intensite_max_a: e.target.value })
                  }
                  placeholder="15, 30, 45..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Usage typique</label>
                <Input
                  value={formData.usage_typique}
                  onChange={(e) =>
                    setFormData({ ...formData, usage_typique: e.target.value })
                  }
                  placeholder="Maison standard avec..."
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

export default DataCalibres;
