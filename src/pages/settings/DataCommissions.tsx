import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Percent, Loader2, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";

interface CommissionData {
  id: string;
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
  bonus_survente: number | null;
}

const DataCommissions = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [data, setData] = useState<CommissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CommissionData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    tranche_min: "0",
    tranche_max: "15000",
    taux_commission: "10",
    bonus_survente: "0",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: commissionData, error } = await supabase
        .from("data_commissions")
        .select("*")
        .order("tranche_min", { ascending: true });

      if (error) throw error;
      setData(commissionData || []);
    } catch (error) {
      console.error("Erreur chargement commissions:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      tranche_min: "0",
      tranche_max: "15000",
      taux_commission: "10",
      bonus_survente: "0",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CommissionData) => {
    setEditItem(item);
    setFormData({
      tranche_min: item.tranche_min.toString(),
      tranche_max: item.tranche_max.toString(),
      taux_commission: item.taux_commission.toString(),
      bonus_survente: (item.bonus_survente || 0).toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tranche_min: parseFloat(formData.tranche_min) || 0,
        tranche_max: parseFloat(formData.tranche_max) || 999999,
        taux_commission: parseFloat(formData.taux_commission) || 0,
        bonus_survente: parseFloat(formData.bonus_survente) || 0,
      };

      if (editItem) {
        const { error } = await supabase
          .from("data_commissions")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Commission modifiée");
      } else {
        const { error } = await supabase.from("data_commissions").insert(payload);
        if (error) throw error;
        toast.success("Commission ajoutée");
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
    if (!confirm("Supprimer cette tranche ?")) return;

    try {
      const { error } = await supabase.from("data_commissions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tranche supprimée");
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

  const maxTaux = Math.max(...data.map((d) => d.taux_commission), 1);

  return (
    <MobileLayout title="Grilles commissions" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Percent className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Barème de commissions</p>
              <p className="text-xs text-muted-foreground mt-1">
                Taux appliqué sur le montant de la vente selon les tranches de
                prix. Le bonus survente s'ajoute si le prix dépasse le recommandé.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions admin */}
        {isAdmin && (
          <Button onClick={openAddDialog} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une tranche
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
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune grille configurée</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tranches de prix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {formatCurrency(item.tranche_min)} -{" "}
                        {formatCurrency(item.tranche_max)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700">
                        {item.taux_commission}%
                      </Badge>
                      {item.bonus_survente && item.bonus_survente > 0 && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-300"
                        >
                          +{item.bonus_survente}%
                        </Badge>
                      )}
                      {isAdmin && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={(item.taux_commission / maxTaux) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Exemple de calcul */}
        {data.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Exemple de calcul
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Pour une vente à 15 000€ avec un taux de{" "}
                {data[0]?.taux_commission || 10}% :
              </p>
              <p className="font-bold text-lg text-primary">
                Commission ={" "}
                {formatCurrency(15000 * ((data[0]?.taux_commission || 10) / 100))}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editItem ? "Modifier la tranche" : "Ajouter une tranche"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tranche min (€)</label>
                  <Input
                    type="number"
                    value={formData.tranche_min}
                    onChange={(e) =>
                      setFormData({ ...formData, tranche_min: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tranche max (€)</label>
                  <Input
                    type="number"
                    value={formData.tranche_max}
                    onChange={(e) =>
                      setFormData({ ...formData, tranche_max: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Taux commission (%)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.taux_commission}
                    onChange={(e) =>
                      setFormData({ ...formData, taux_commission: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Bonus survente (%)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.bonus_survente}
                    onChange={(e) =>
                      setFormData({ ...formData, bonus_survente: e.target.value })
                    }
                  />
                </div>
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

export default DataCommissions;
