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
  prix_hejja: number | null;
  commission_fixe: number | null;
  commission_pct: number | null;
  actif: boolean;
  description: string | null;
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
  
  // État local pour le mode de calcul (permet de modifier sans sauvegarder immédiatement)
  const [pendingModeCalcul, setPendingModeCalcul] = useState<"pourcentage" | "bouquet" | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  
  // Dialogs state
  const [isTrancheDialogOpen, setIsTrancheDialogOpen] = useState(false);
  const [isBouquetDialogOpen, setIsBouquetDialogOpen] = useState(false);
  const [editTranche, setEditTranche] = useState<CommissionData | null>(null);
  const [editBouquet, setEditBouquet] = useState<BouquetData | null>(null);
  
  // Form data
  const [trancheFormData, setTrancheFormData] = useState({
    tranche_min: "0",
    tranche_max: "15000",
    taux_commission: "10",
    bonus_survente: "0",
  });
  
  const [useTauxUnique, setUseTauxUnique] = useState(false);
  const [tauxUnique, setTauxUnique] = useState("10");
  
  const [bouquetFormData, setBouquetFormData] = useState({
    nom_bouquet: "",
    puissance_kwc: "3",
    prix_recommande: "10000",
    prix_hejja: "12000",
    prix_max: "15000",
    commission_fixe: "500",
    description: "",
  });
  
  const [saving, setSaving] = useState(false);
  
  // Le mode affiché est soit le pending (non sauvegardé) soit le mode actuel
  const displayedMode = pendingModeCalcul ?? config?.mode_calcul ?? "bouquet";
  const hasPendingModeChange = pendingModeCalcul !== null && pendingModeCalcul !== config?.mode_calcul;

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

  // Handler pour sauvegarder le changement de mode
  const handleSaveModeChange = async () => {
    if (!pendingModeCalcul || !config) return;
    
    setSavingMode(true);
    try {
      const { error } = await supabase
        .from("config_commissions")
        .update({ mode_calcul: pendingModeCalcul })
        .eq("id", config.id);
      
      if (error) throw error;
      
      setConfig({ ...config, mode_calcul: pendingModeCalcul });
      setPendingModeCalcul(null);
      toast.success("Mode de commission mis à jour");
    } catch (error: any) {
      console.error("Erreur mise à jour mode:", error);
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setSavingMode(false);
    }
  };

  const handleCancelModeChange = () => {
    setPendingModeCalcul(null);
  };

  // Tranche handlers
  const openAddTrancheDialog = () => {
    setEditTranche(null);
    setTrancheFormData({
      tranche_min: "0",
      tranche_max: "15000",
      taux_commission: "10",
      bonus_survente: "0",
    });
    setIsTrancheDialogOpen(true);
  };

  const openEditTrancheDialog = (item: CommissionData) => {
    setEditTranche(item);
    setTrancheFormData({
      tranche_min: item.tranche_min.toString(),
      tranche_max: item.tranche_max.toString(),
      taux_commission: item.taux_commission.toString(),
      bonus_survente: (item.bonus_survente || 0).toString(),
    });
    setIsTrancheDialogOpen(true);
  };

  const handleSaveTranche = async () => {
    setSaving(true);
    try {
      const payload = {
        tranche_min: parseFloat(trancheFormData.tranche_min) || 0,
        tranche_max: parseFloat(trancheFormData.tranche_max) || 999999,
        taux_commission: parseFloat(trancheFormData.taux_commission) || 0,
        bonus_survente: parseFloat(trancheFormData.bonus_survente) || 0,
      };

      if (editTranche) {
        const { error } = await supabase
          .from("data_commissions")
          .update(payload)
          .eq("id", editTranche.id);
        if (error) throw error;
        toast.success("Tranche modifiée");
      } else {
        const { error } = await supabase.from("data_commissions").insert(payload);
        if (error) throw error;
        toast.success("Tranche ajoutée");
      }

      setIsTrancheDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTranche = async (id: string) => {
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

  // Bouquet handlers
  const openAddBouquetDialog = () => {
    setEditBouquet(null);
    setBouquetFormData({
      nom_bouquet: "",
      puissance_kwc: "3",
      prix_recommande: "10000",
      prix_hejja: "12000",
      prix_max: "15000",
      commission_fixe: "500",
      description: "",
    });
    setIsBouquetDialogOpen(true);
  };

  const openEditBouquetDialog = (bouquet: BouquetData) => {
    setEditBouquet(bouquet);
    setBouquetFormData({
      nom_bouquet: bouquet.nom_bouquet,
      puissance_kwc: bouquet.puissance_kwc.toString(),
      prix_recommande: bouquet.prix_recommande.toString(),
      prix_hejja: (bouquet.prix_hejja || 0).toString(),
      prix_max: bouquet.prix_max.toString(),
      commission_fixe: (bouquet.commission_fixe || 0).toString(),
      description: bouquet.description || "",
    });
    setIsBouquetDialogOpen(true);
  };

  const handleSaveBouquet = async () => {
    if (!bouquetFormData.nom_bouquet.trim()) {
      toast.error("Le nom du bouquet est requis");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        nom_bouquet: bouquetFormData.nom_bouquet.trim(),
        puissance_kwc: parseFloat(bouquetFormData.puissance_kwc) || 0,
        prix_recommande: parseFloat(bouquetFormData.prix_recommande) || 0,
        prix_hejja: parseFloat(bouquetFormData.prix_hejja) || 0,
        prix_max: parseFloat(bouquetFormData.prix_max) || 0,
        commission_fixe: parseFloat(bouquetFormData.commission_fixe) || 0,
        description: bouquetFormData.description.trim() || null,
        actif: true,
      };

      if (editBouquet) {
        const { error } = await supabase
          .from("data_prix_bouquets")
          .update(payload)
          .eq("id", editBouquet.id);
        if (error) throw error;
        toast.success("Bouquet modifié");
      } else {
        const { error } = await supabase.from("data_prix_bouquets").insert(payload);
        if (error) throw error;
        toast.success("Bouquet ajouté");
      }

      setIsBouquetDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde bouquet:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBouquet = async (id: string) => {
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

  const toggleBouquetActif = async (bouquet: BouquetData) => {
    try {
      const { error } = await supabase
        .from("data_prix_bouquets")
        .update({ actif: !bouquet.actif })
        .eq("id", bouquet.id);
      if (error) throw error;
      toast.success(bouquet.actif ? "Bouquet désactivé" : "Bouquet activé");
      fetchData();
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour");
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
        {/* Config Mode - Bouton Switch Principal */}
        {config && (
          <Card className={`border-primary/20 ${hasPendingModeChange ? 'ring-2 ring-amber-500' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Mode de commission
                {hasPendingModeChange && (
                  <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                    Non enregistré
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Percent className={`h-5 w-5 ${displayedMode === "pourcentage" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${displayedMode === "pourcentage" ? "text-foreground" : "text-muted-foreground"}`}>
                    Pourcentage
                  </span>
                </div>
                <Switch
                  checked={displayedMode === "bouquet"}
                  onCheckedChange={(checked) => {
                    const newMode = checked ? "bouquet" : "pourcentage";
                    if (newMode === config.mode_calcul) {
                      setPendingModeCalcul(null);
                    } else {
                      setPendingModeCalcul(newMode);
                    }
                  }}
                />
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${displayedMode === "bouquet" ? "text-foreground" : "text-muted-foreground"}`}>
                    Bouquet
                  </span>
                  <Package className={`h-5 w-5 ${displayedMode === "bouquet" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
              </div>

              {/* Boutons de sauvegarde/annulation */}
              {hasPendingModeChange && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelModeChange}
                    disabled={savingMode}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveModeChange}
                    disabled={savingMode}
                  >
                    {savingMode ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Enregistrer
                  </Button>
                </div>
              )}

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
                  ? `Commission selon le bouquet vendu. Survente : ${config?.part_survente_pct || 50}% pour le commercial.`
                  : `Taux appliqué selon les tranches de prix. Survente : ${config?.part_survente_pct || 50}% pour le commercial.`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="bouquet" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bouquet" className="gap-2">
              <Package className="h-4 w-4" />
              Bouquets
            </TabsTrigger>
            <TabsTrigger value="pourcentage" className="gap-2">
              <Percent className="h-4 w-4" />
              Tranches %
            </TabsTrigger>
          </TabsList>

          {/* Tranches Tab */}
          <TabsContent value="pourcentage" className="space-y-4">
            {/* Option Taux Unique */}
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Taux unique</p>
                    <p className="text-xs text-muted-foreground">
                      Appliquer le même taux à toutes les ventes
                    </p>
                  </div>
                  <Switch
                    checked={useTauxUnique}
                    onCheckedChange={setUseTauxUnique}
                  />
                </div>
                {useTauxUnique && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={tauxUnique}
                      onChange={(e) => setTauxUnique(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% sur toutes les ventes</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {!useTauxUnique && (
              <>
                <Button onClick={openAddTrancheDialog} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter une tranche
                </Button>

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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditTrancheDialog(item)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteTranche(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <Progress value={(item.taux_commission / maxTaux) * 100} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {useTauxUnique && (
              <Card className="bg-muted/50">
                <CardContent className="py-8 text-center">
                  <Percent className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <p className="font-bold text-2xl text-primary">{tauxUnique}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Taux unique appliqué à toutes les ventes
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Bouquets Tab */}
          <TabsContent value="bouquet" className="space-y-4">
            <Button onClick={openAddBouquetDialog} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un bouquet travaux
            </Button>

            {bouquets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun bouquet configuré</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Bouquets travaux</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bouquets.map((bouquet) => (
                    <div
                      key={bouquet.id}
                      className={`p-3 rounded-lg border ${bouquet.actif ? "bg-card" : "bg-muted/50 opacity-60"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{bouquet.nom_bouquet}</p>
                            {!bouquet.actif && (
                              <Badge variant="secondary" className="text-xs">Inactif</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {bouquet.puissance_kwc} kWc
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditBouquetDialog(bouquet)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteBouquet(bouquet.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-muted-foreground">Prix standard</p>
                          <p className="font-medium">{formatCurrency(bouquet.prix_recommande)}</p>
                          <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Com: {formatCurrency(bouquet.commission_fixe || 0)}
                          </Badge>
                        </div>
                        <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20">
                          <p className="text-muted-foreground">Prix HEJJA</p>
                          <p className="font-medium">{formatCurrency(bouquet.prix_hejja || 0)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Survente: {formatCurrency((bouquet.prix_hejja || 0) - bouquet.prix_recommande)}
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="mt-2 pt-2 border-t flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Activer ce bouquet</span>
                          <Switch
                            checked={bouquet.actif}
                            onCheckedChange={() => toggleBouquetActif(bouquet)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Exemple survente */}
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
                    Bouquet vendu à 14 000€ HT (prix standard: 10 000€) :
                  </p>
                  <div className="space-y-1">
                    <p>
                      Commission de base :{" "}
                      <span className="font-medium">
                        {formatCurrency(bouquets[0]?.commission_fixe || 500)}
                      </span>
                    </p>
                    <p>
                      Survente ({config?.part_survente_pct || 50}% de 4 000€) :{" "}
                      <span className="font-medium text-amber-600">
                        +{formatCurrency(4000 * ((config?.part_survente_pct || 50) / 100))}
                      </span>
                    </p>
                    <p className="font-bold text-lg text-primary pt-1">
                      Total ={" "}
                      {formatCurrency(
                        (bouquets[0]?.commission_fixe || 500) +
                        4000 * ((config?.part_survente_pct || 50) / 100)
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog Tranches */}
        <Dialog open={isTrancheDialogOpen} onOpenChange={setIsTrancheDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editTranche ? "Modifier la tranche" : "Ajouter une tranche"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tranche min (€)</Label>
                  <Input
                    type="number"
                    value={trancheFormData.tranche_min}
                    onChange={(e) => setTrancheFormData({ ...trancheFormData, tranche_min: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tranche max (€)</Label>
                  <Input
                    type="number"
                    value={trancheFormData.tranche_max}
                    onChange={(e) => setTrancheFormData({ ...trancheFormData, tranche_max: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Taux commission (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={trancheFormData.taux_commission}
                    onChange={(e) => setTrancheFormData({ ...trancheFormData, taux_commission: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bonus survente (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={trancheFormData.bonus_survente}
                    onChange={(e) => setTrancheFormData({ ...trancheFormData, bonus_survente: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTrancheDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSaveTranche} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editTranche ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Bouquet */}
        <Dialog open={isBouquetDialogOpen} onOpenChange={setIsBouquetDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editBouquet ? "Modifier le bouquet" : "Ajouter un bouquet travaux"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom du bouquet *</Label>
                <Input
                  value={bouquetFormData.nom_bouquet}
                  onChange={(e) => setBouquetFormData({ ...bouquetFormData, nom_bouquet: e.target.value })}
                  placeholder="Ex: Pack 3 kWc Standard"
                />
              </div>
              
              <div>
                <Label>Puissance (kWc)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={bouquetFormData.puissance_kwc}
                  onChange={(e) => setBouquetFormData({ ...bouquetFormData, puissance_kwc: e.target.value })}
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                <p className="text-sm font-medium">Mode Standard</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Prix (€ HT)</Label>
                    <Input
                      type="number"
                      value={bouquetFormData.prix_recommande}
                      onChange={(e) => setBouquetFormData({ ...bouquetFormData, prix_recommande: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Commission (€)</Label>
                    <Input
                      type="number"
                      value={bouquetFormData.commission_fixe}
                      onChange={(e) => setBouquetFormData({ ...bouquetFormData, commission_fixe: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 space-y-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Mode HEJJA</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Prix HEJJA (€ HT)</Label>
                    <Input
                      type="number"
                      value={bouquetFormData.prix_max}
                      onChange={(e) => setBouquetFormData({ ...bouquetFormData, prix_max: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Prix HEJJA TTC (€)</Label>
                    <Input
                      type="number"
                      value={bouquetFormData.prix_hejja}
                      onChange={(e) => setBouquetFormData({ ...bouquetFormData, prix_hejja: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Description (optionnelle)</Label>
                <Input
                  value={bouquetFormData.description}
                  onChange={(e) => setBouquetFormData({ ...bouquetFormData, description: e.target.value })}
                  placeholder="Détails du bouquet..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBouquetDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={handleSaveBouquet} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editBouquet ? "Modifier" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
};

export default DataCommissions;
