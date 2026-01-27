import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Euro, 
  Sun,
  Thermometer,
  Home,
  Check,
  Loader2,
} from "lucide-react";
import { BouquetExtractor } from "./BouquetExtractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProductType = "PV" | "PAC" | "ITE";

interface RegieBouquet {
  id: string;
  regie_id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  prix_hejja: number;
  commission_fixe: number;
  commission_pct: number;
  description: string | null;
  actif: boolean;
  product_type: ProductType | null;
  isGlobal?: boolean;
}

interface SelectedRegie {
  id: string;
  nom: string;
  mode_calcul_commission: string;
  part_survente_pct: number;
}

interface ProductBouquetsSectionProps {
  selectedRegie: SelectedRegie;
  regieBouquets: RegieBouquet[];
  userId: string;
  onRefresh: () => void;
  onUpdateCommissionMode: (mode: 'pourcentage' | 'bouquet') => void;
  onUpdateSurventePct: (pct: number) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const productConfig: Record<ProductType, { label: string; icon: React.ElementType; color: string; unit: string; unitLabel: string }> = {
  PV: { label: "Photovoltaïque", icon: Sun, color: "text-amber-600", unit: "kWc", unitLabel: "Puissance (kWc)" },
  PAC: { label: "Pompe à Chaleur", icon: Thermometer, color: "text-blue-600", unit: "kW", unitLabel: "Puissance (kW)" },
  ITE: { label: "Isolation", icon: Home, color: "text-green-600", unit: "m²", unitLabel: "Surface (m²)" },
};

export function ProductBouquetsSection({
  selectedRegie,
  regieBouquets,
  userId,
  onRefresh,
  onUpdateCommissionMode,
  onUpdateSurventePct,
}: ProductBouquetsSectionProps) {
  const [activeProductTab, setActiveProductTab] = useState<ProductType>("PV");
  const [saving, setSaving] = useState(false);
  
  // Form state for new bouquet
  const [newBouquet, setNewBouquet] = useState({
    nom_bouquet: "",
    puissance_kwc: 3,
    prix_recommande: 0,
    prix_max: 0,
    prix_hejja: 0,
    commission_fixe: 0,
  });

  // Filter bouquets by product type (null = PV for backwards compatibility)
  // Only show active bouquets
  const getBouquetsByProduct = (productType: ProductType) => {
    return regieBouquets.filter(b => {
      // Only show active bouquets
      if (!b.actif) return false;
      
      if (productType === "PV") {
        return !b.product_type || b.product_type === "PV";
      }
      return b.product_type === productType;
    });
  };

  const handleAddBouquet = async (productType: ProductType) => {
    if (!newBouquet.nom_bouquet.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("bouquets").insert({
        user_id: userId,
        nom_bouquet: newBouquet.nom_bouquet.trim(),
        puissance_kwc: newBouquet.puissance_kwc,
        prix_recommande: newBouquet.prix_recommande,
        prix_max: newBouquet.prix_max,
        prix_hejja: newBouquet.prix_hejja,
        commission_fixe: newBouquet.commission_fixe,
        regie_ids: [selectedRegie.id],
        product_type: productType,
        actif: true,
      });

      if (error) throw error;

      toast.success("Bouquet ajouté");
      setNewBouquet({
        nom_bouquet: "",
        puissance_kwc: productType === "ITE" ? 100 : 3,
        prix_recommande: 0,
        prix_max: 0,
        prix_hejja: 0,
        commission_fixe: 0,
      });
      onRefresh();
    } catch (error) {
      console.error("Error adding bouquet:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBouquet = async (bouquet: RegieBouquet) => {
    try {
      if (bouquet.isGlobal) {
        // For global bouquets, create a regie-specific inactive copy to "exclude" it
        const { error } = await supabase.from("bouquets").insert({
          user_id: userId,
          nom_bouquet: bouquet.nom_bouquet,
          puissance_kwc: bouquet.puissance_kwc,
          prix_recommande: bouquet.prix_recommande,
          prix_max: bouquet.prix_max,
          prix_hejja: bouquet.prix_hejja || 0,
          commission_fixe: bouquet.commission_fixe,
          commission_pct: bouquet.commission_pct || 0,
          description: bouquet.description,
          regie_ids: [selectedRegie.id],
          product_type: bouquet.product_type || "PV",
          actif: false, // Mark as inactive for this regie
        });

        if (error) throw error;
        toast.success("Bouquet désactivé pour cette régie");
      } else {
        // For regie-specific bouquets, just delete or deactivate
        const { error } = await supabase
          .from("bouquets")
          .update({ actif: false })
          .eq("id", bouquet.id);
        if (error) throw error;
        toast.success("Bouquet désactivé");
      }
      onRefresh();
    } catch (error) {
      console.error("Error deleting bouquet:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const config = productConfig[activeProductTab];

  return (
    <div className="space-y-4">
      {/* Configuration du mode de calcul */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Mode de calcul des commissions</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={selectedRegie.mode_calcul_commission === 'bouquet' ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => onUpdateCommissionMode('bouquet')}
            >
              <Check className={selectedRegie.mode_calcul_commission === 'bouquet' ? 'h-4 w-4' : 'h-4 w-4 opacity-0'} />
              Bouquet + Survente
            </Button>
            <Button
              variant={selectedRegie.mode_calcul_commission === 'pourcentage' ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => onUpdateCommissionMode('pourcentage')}
            >
              <Check className={selectedRegie.mode_calcul_commission === 'pourcentage' ? 'h-4 w-4' : 'h-4 w-4 opacity-0'} />
              % sur CA
            </Button>
          </div>

          {selectedRegie.mode_calcul_commission === 'bouquet' && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Part de survente reversée (%)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedRegie.part_survente_pct}
                  onChange={(e) => onUpdateSurventePct(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Commission = Fixe bouquet + {selectedRegie.part_survente_pct}% de (Prix vendu - Prix recommandé) HT
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRegie.mode_calcul_commission === 'bouquet' && (
        <>
          {/* Onglets par type de produit */}
          <Tabs value={activeProductTab} onValueChange={(v) => setActiveProductTab(v as ProductType)}>
            <TabsList className="w-full grid grid-cols-3">
              {(Object.keys(productConfig) as ProductType[]).map((type) => {
                const cfg = productConfig[type];
                const count = getBouquetsByProduct(type).length;
                return (
                  <TabsTrigger key={type} value={type} className="gap-1.5 text-xs">
                    <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className="hidden sm:inline">{cfg.label}</span>
                    <span className="sm:hidden">{type}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(productConfig) as ProductType[]).map((productType) => {
              const cfg = productConfig[productType];
              const bouquets = getBouquetsByProduct(productType);
              
              return (
                <TabsContent key={productType} value={productType} className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Tarifs et commissions <span className="font-medium">{cfg.label}</span>
                  </p>

                  {/* Extraction AI - tous produits */}
                  <BouquetExtractor
                    regieId={selectedRegie.id}
                    userId={userId}
                    onBouquetsCreated={onRefresh}
                    productType={productType}
                  />
                  
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">ou ajouter manuellement</span>
                    </div>
                  </div>

                  {/* Formulaire ajout bouquet */}
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <Input
                        placeholder={`Nom du ${productType === "ITE" ? "forfait" : "bouquet"}`}
                        value={newBouquet.nom_bouquet}
                        onChange={(e) => setNewBouquet({ ...newBouquet, nom_bouquet: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">{cfg.unitLabel}</label>
                          <Input
                            type="number"
                            step={productType === "ITE" ? "10" : "0.1"}
                            value={newBouquet.puissance_kwc}
                            onChange={(e) => setNewBouquet({ ...newBouquet, puissance_kwc: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Prix recommandé TTC</label>
                          <Input
                            type="number"
                            value={newBouquet.prix_recommande}
                            onChange={(e) => setNewBouquet({ ...newBouquet, prix_recommande: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Prix max TTC</label>
                          <Input
                            type="number"
                            value={newBouquet.prix_max}
                            onChange={(e) => setNewBouquet({ ...newBouquet, prix_max: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Commission HT €</label>
                          <Input
                            type="number"
                            value={newBouquet.commission_fixe}
                            onChange={(e) => setNewBouquet({ ...newBouquet, commission_fixe: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleAddBouquet(productType)} 
                        disabled={!newBouquet.nom_bouquet.trim() || saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Ajouter
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Liste des bouquets */}
                  {bouquets.map((bouquet) => (
                    <Card key={bouquet.id} className={bouquet.isGlobal ? "border-dashed" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{bouquet.nom_bouquet}</p>
                          {bouquet.isGlobal && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                  Par défaut
                                </Badge>
                              )}
                              {!bouquet.actif && (
                                <Badge variant="secondary" className="text-[10px] h-4 bg-destructive/10 text-destructive">
                                  Désactivé
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {bouquet.puissance_kwc} {cfg.unit}
                            </p>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive h-8 w-8"
                            onClick={() => handleDeleteBouquet(bouquet)}
                            title={bouquet.isGlobal ? "Désactiver pour cette régie" : "Désactiver"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-4 mt-3">
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prix reco.</p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatCurrency(bouquet.prix_recommande)}
                            </p>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Commission HT</p>
                            <p className="text-sm font-semibold text-green-600">
                              {formatCurrency(bouquet.commission_fixe)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {bouquets.length === 0 && (
                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="p-6 text-center">
                        <cfg.icon className={`h-8 w-8 mx-auto mb-2 ${cfg.color} opacity-50`} />
                        <p className="text-sm text-muted-foreground">
                          Aucun {productType === "ITE" ? "forfait" : "bouquet"} {cfg.label} configuré
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ajoutez des tarifs pour calculer les commissions
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}

      {selectedRegie.mode_calcul_commission === 'pourcentage' && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              En mode pourcentage, les commissions sont calculées selon les tranches définies dans les paramètres globaux.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
