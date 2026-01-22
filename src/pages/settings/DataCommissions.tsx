import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Percent, Loader2, TrendingUp, Plus, Pencil, Trash2, Package, Settings2 } from "lucide-react";

interface CommissionData {
  id: string;
  tranche_min: number;
  tranche_max: number;
  taux_commission: number;
  bonus_survente: number | null;
}

interface BouquetData {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  commission_fixe: number | null;
  commission_pct: number | null;
  actif: boolean;
}

interface ConfigCommission {
  id: string;
  mode_calcul: "pourcentage" | "bouquet";
  part_survente_pct: number;
}

const DataCommissions = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [tranches, setTranches] = useState<CommissionData[]>([]);
  const [bouquets, setBouquets] = useState<BouquetData[]>([]);
  const [config, setConfig] = useState<ConfigCommission | null>(null);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CommissionData | null>(null);
  const [editBouquet, setEditBouquet] = useState<BouquetData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBouquetDialogOpen, setIsBouquetDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    tranche_min: "0",
    tranche_max: "15000",
    taux_commission: "10",
    bonus_survente: "0",
  });
  const [bouquetFormData, setBouquetFormData] = useState({
    commission_fixe: "0",
    commission_pct: "0",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tranchesRes, bouquetsRes, configRes] = await Promise.all([
        supabase.from("data_commissions").select("*").order("tranche_min", { ascending: true }),
        supabase.from("data_prix_bouquets").select("*").order("puissance_kwc", { ascending: true }),
        supabase.from("config_commissions").select("*").limit(1).single(),
      ]);

      if (tranchesRes.error) throw tranchesRes.error;
      if (bouquetsRes.error) throw bouquetsRes.error;

      setTranches(tranchesRes.data || []);
      setBouquets(bouquetsRes.data || []);
      
      if (configRes.data) {
        setConfig(configRes.data as ConfigCommission);
      }
    } catch (error) {
      console.error("Erreur chargement commissions:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<ConfigCommission>) => {
    if (!config) return;
    
    try {
      const { error } = await supabase
        .from("config_commissions")
        .update(updates)
        .eq("id", config.id);
      
      if (error) throw error;
      
      setConfig({ ...config, ...updates });
      toast.success("Configuration mise à jour");
    } catch (error: any) {
      console.error("Erreur mise à jour config:", error);
      toast.error(error.message || "Erreur lors de la mise à jour");
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

  const openBouquetEditDialog = (bouquet: BouquetData) => {
    setEditBouquet(bouquet);
    setBouquetFormData({
      commission_fixe: (bouquet.commission_fixe || 0).toString(),
      commission_pct: (bouquet.commission_pct || 0).toString(),
    });
    setIsBouquetDialogOpen(true);
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

  const handleSaveBouquet = async () => {
    if (!editBouquet) return;
    
    setSaving(true);
    try {
      const payload = {
        commission_fixe: parseFloat(bouquetFormData.commission_fixe) || 0,
        commission_pct: parseFloat(bouquetFormData.commission_pct) || 0,
      };

      const { error } = await supabase
        .from("data_prix_bouquets")
        .update(payload)
        .eq("id", editBouquet.id);
      
      if (error) throw error;
      toast.success("Commission bouquet mise à jour");
      setIsBouquetDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde bouquet:", error);
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

  const maxTaux = Math.max(...tranches.map((d) => d.taux_commission), 1);

  if (loading || roleLoading) {
    return (
      <MobileLayout title="Grilles commissions" showBackButton>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Grilles commissions" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Config Mode */}
        {isAdmin && config && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Mode de calcul</Label>
                  <p className="text-xs text-muted-foreground">
                    {config.mode_calcul === "pourcentage" 
                      ? "Basé sur les tranches de prix" 
                      : "Basé sur les bouquets vendus"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${config.mode_calcul === "pourcentage" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    %
                  </span>
                  <Switch
                    checked={config.mode_calcul === "bouquet"}
                    onCheckedChange={(checked) => 
                      updateConfig({ mode_calcul: checked ? "bouquet" : "pourcentage" })
                    }
                  />
                  <span className={`text-sm ${config.mode_calcul === "bouquet" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    Bouquet
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Part survente commercial</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={config.part_survente_pct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateConfig({ part_survente_pct: Math.min(100, Math.max(0, val)) });
                    }}
                    className="w-24"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm text-muted-foreground">% du montant HT de survente</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si le prix de vente dépasse le prix recommandé, le commercial perçoit cette part de la différence.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-start gap-3">
            {config?.mode_calcul === "bouquet" ? (
              <Package className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Percent className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">
                {config?.mode_calcul === "bouquet" 
                  ? "Commission par bouquet" 
                  : "Barème de commissions"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {config?.mode_calcul === "bouquet"
                  ? `Commission fixe + % du prix selon le bouquet vendu. Survente : ${config?.part_survente_pct || 50}% pour le commercial.`
                  : `Taux appliqué sur le montant de la vente selon les tranches de prix. Survente : ${config?.part_survente_pct || 50}% pour le commercial.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue={config?.mode_calcul || "pourcentage"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pourcentage" className="gap-2">
              <Percent className="h-4 w-4" />
              Tranches %
            </TabsTrigger>
            <TabsTrigger value="bouquet" className="gap-2">
              <Package className="h-4 w-4" />
              Bouquets
            </TabsTrigger>
          </TabsList>

          {/* Tranches Tab */}
          <TabsContent value="pourcentage" className="space-y-4">
            {isAdmin && (
              <Button onClick={openAddDialog} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une tranche
              </Button>
            )}

            {tranches.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune tranche configurée</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tranches de prix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tranches.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {formatCurrency(item.tranche_min)} - {formatCurrency(item.tranche_max)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {item.taux_commission}%
                          </Badge>
                          {item.bonus_survente && item.bonus_survente > 0 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
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
                      <Progress value={(item.taux_commission / maxTaux) * 100} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tranches.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Exemple de calcul
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Pour une vente à 15 000€ avec un taux de {tranches[0]?.taux_commission || 10}% :
                  </p>
                  <p className="font-bold text-lg text-primary">
                    Commission = {formatCurrency(15000 * ((tranches[0]?.taux_commission || 10) / 100))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    + {config?.part_survente_pct || 50}% de la survente si prix {">"} recommandé
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Bouquets Tab */}
          <TabsContent value="bouquet" className="space-y-4">
            {bouquets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun bouquet configuré</p>
                  <p className="text-xs mt-1">Allez dans Bouquets pour en créer</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Commissions par bouquet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bouquets.map((bouquet) => (
                    <div
                      key={bouquet.id}
                      className={`p-3 rounded-lg border ${bouquet.actif ? "bg-card" : "bg-muted/50 opacity-60"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{bouquet.nom_bouquet}</p>
                          <p className="text-xs text-muted-foreground">
                            {bouquet.puissance_kwc} kWc • Prix reco: {formatCurrency(bouquet.prix_recommande)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(bouquet.commission_fixe || 0) > 0 && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {formatCurrency(bouquet.commission_fixe || 0)}
                            </Badge>
                          )}
                          {(bouquet.commission_pct || 0) > 0 && (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              +{bouquet.commission_pct}%
                            </Badge>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openBouquetEditDialog(bouquet)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {bouquet.actif && ((bouquet.commission_fixe || 0) > 0 || (bouquet.commission_pct || 0) > 0) && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          Commission totale estimée :{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(
                              (bouquet.commission_fixe || 0) +
                              bouquet.prix_recommande * ((bouquet.commission_pct || 0) / 100)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {bouquets.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Exemple avec survente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Bouquet vendu à 18 000€ HT (prix reco: 15 000€) :
                  </p>
                  <div className="space-y-1">
                    <p>
                      Commission de base :{" "}
                      <span className="font-medium">
                        {formatCurrency((bouquets[0]?.commission_fixe || 500) + 15000 * ((bouquets[0]?.commission_pct || 5) / 100))}
                      </span>
                    </p>
                    <p>
                      Survente ({config?.part_survente_pct || 50}% de 3 000€) :{" "}
                      <span className="font-medium text-amber-600">
                        +{formatCurrency(3000 * ((config?.part_survente_pct || 50) / 100))}
                      </span>
                    </p>
                    <p className="font-bold text-lg text-primary pt-1">
                      Total ={" "}
                      {formatCurrency(
                        (bouquets[0]?.commission_fixe || 500) +
                        15000 * ((bouquets[0]?.commission_pct || 5) / 100) +
                        3000 * ((config?.part_survente_pct || 50) / 100)
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog Tranches */}
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
                    onChange={(e) => setFormData({ ...formData, tranche_min: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tranche max (€)</label>
                  <Input
                    type="number"
                    value={formData.tranche_max}
                    onChange={(e) => setFormData({ ...formData, tranche_max: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, taux_commission: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Bonus survente (%)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.bonus_survente}
                    onChange={(e) => setFormData({ ...formData, bonus_survente: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editItem ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Bouquet Commission */}
        <Dialog open={isBouquetDialogOpen} onOpenChange={setIsBouquetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Commission - {editBouquet?.nom_bouquet}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Puissance :</strong> {editBouquet?.puissance_kwc} kWc</p>
                <p><strong>Prix recommandé :</strong> {formatCurrency(editBouquet?.prix_recommande || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Commission fixe (€)</label>
                <Input
                  type="number"
                  value={bouquetFormData.commission_fixe}
                  onChange={(e) => setBouquetFormData({ ...bouquetFormData, commission_fixe: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Montant fixe par vente</p>
              </div>
              <div>
                <label className="text-sm font-medium">Commission variable (%)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={bouquetFormData.commission_pct}
                  onChange={(e) => setBouquetFormData({ ...bouquetFormData, commission_pct: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Pourcentage du prix de vente</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBouquetDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSaveBouquet} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
};

export default DataCommissions;
