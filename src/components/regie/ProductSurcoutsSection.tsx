import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Sun,
  Thermometer,
  Home,
  Loader2,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProductType = "PV" | "PAC" | "ITE";

interface RegieSurcout {
  id: string;
  regie_id: string | null;
  categorie: string;
  code: string;
  nom: string;
  prix: number;
  type_calcul: 'fixe' | 'par_panneau' | 'par_m2';
  actif: boolean;
  isGlobal?: boolean;
  product_type?: ProductType | null;
}

interface ProductSurcoutsSectionProps {
  regieId: string;
  userId: string;
  regieSurcouts: RegieSurcout[];
  onRefresh: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Configuration des catégories par type de produit
const productConfig: Record<ProductType, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  categories: { value: string; label: string }[];
  typeCalculOptions: { value: string; label: string }[];
}> = {
  PV: { 
    label: "Photovoltaïque", 
    icon: Sun, 
    color: "text-amber-600",
    categories: [
      { value: "support", label: "Support d'installation" },
      { value: "emplacement_boitier", label: "Emplacement boîtier" },
      { value: "compteur", label: "Type de compteur" },
    ],
    typeCalculOptions: [
      { value: "fixe", label: "Forfait fixe" },
      { value: "par_panneau", label: "Par panneau" },
    ],
  },
  PAC: { 
    label: "Pompe à Chaleur", 
    icon: Thermometer, 
    color: "text-blue-600",
    categories: [
      { value: "type_pac", label: "Type de PAC" },
      { value: "installation", label: "Installation" },
      { value: "accessoires", label: "Accessoires" },
    ],
    typeCalculOptions: [
      { value: "fixe", label: "Forfait fixe" },
    ],
  },
  ITE: { 
    label: "Isolation", 
    icon: Home, 
    color: "text-green-600",
    categories: [
      { value: "finition", label: "Type de finition" },
      { value: "complexite", label: "Complexité chantier" },
      { value: "accessoires_ite", label: "Accessoires" },
    ],
    typeCalculOptions: [
      { value: "fixe", label: "Forfait fixe" },
      { value: "par_m2", label: "Par m²" },
    ],
  },
};

const getCategorieLabel = (categorie: string): string => {
  const allCategories = [
    ...productConfig.PV.categories,
    ...productConfig.PAC.categories,
    ...productConfig.ITE.categories,
  ];
  return allCategories.find(c => c.value === categorie)?.label || categorie;
};

export function ProductSurcoutsSection({
  regieId,
  userId,
  regieSurcouts,
  onRefresh,
}: ProductSurcoutsSectionProps) {
  const [activeProductTab, setActiveProductTab] = useState<ProductType>("PV");
  const [saving, setSaving] = useState(false);
  
  // Form state for new surcout
  const [newSurcout, setNewSurcout] = useState({
    categorie: "support",
    code: "",
    nom: "",
    prix: 0,
    type_calcul: "fixe" as string,
  });

  // Reset form when changing product type
  const handleTabChange = (productType: ProductType) => {
    setActiveProductTab(productType);
    const defaultCat = productConfig[productType].categories[0]?.value || "";
    const defaultCalc = productConfig[productType].typeCalculOptions[0]?.value || "fixe";
    setNewSurcout({
      categorie: defaultCat,
      code: "",
      nom: "",
      prix: 0,
      type_calcul: defaultCalc,
    });
  };

  // Filter surcouts by product type based on category
  const getSurcoutsByProduct = (productType: ProductType) => {
    const productCategories = productConfig[productType].categories.map(c => c.value);
    return regieSurcouts.filter(s => productCategories.includes(s.categorie));
  };

  const handleAddSurcout = async (productType: ProductType) => {
    if (!newSurcout.code.trim() || !newSurcout.nom.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("regies_surcouts").insert({
        user_id: userId,
        regie_id: regieId,
        categorie: newSurcout.categorie,
        code: newSurcout.code.trim().toLowerCase().replace(/\s+/g, "_"),
        nom: newSurcout.nom.trim(),
        prix: newSurcout.prix,
        type_calcul: newSurcout.type_calcul,
        actif: true,
      });

      if (error) throw error;

      toast.success("Surcoût ajouté");
      setNewSurcout({
        categorie: productConfig[productType].categories[0]?.value || "",
        code: "",
        nom: "",
        prix: 0,
        type_calcul: productConfig[productType].typeCalculOptions[0]?.value || "fixe",
      });
      onRefresh();
    } catch (error) {
      console.error("Error adding surcout:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSurcout = async (surcout: RegieSurcout) => {
    if (surcout.isGlobal) {
      toast.error("Impossible de supprimer un surcoût par défaut");
      return;
    }
    
    try {
      const { error } = await supabase.from("regies_surcouts").delete().eq("id", surcout.id);
      if (error) throw error;
      toast.success("Surcoût supprimé");
      onRefresh();
    } catch (error) {
      console.error("Error deleting surcout:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleToggleSurcoutActif = async (surcout: RegieSurcout) => {
    try {
      if (surcout.isGlobal) {
        // Create a copy with this regie and opposite actif status
        const { error } = await supabase.from("regies_surcouts").insert({
          user_id: userId,
          regie_id: regieId,
          categorie: surcout.categorie,
          code: surcout.code,
          nom: surcout.nom,
          prix: surcout.prix,
          type_calcul: surcout.type_calcul,
          actif: !surcout.actif,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("regies_surcouts")
          .update({ actif: !surcout.actif })
          .eq("id", surcout.id);
        if (error) throw error;
      }
      onRefresh();
    } catch (error) {
      console.error("Error toggling surcout:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Surcoûts techniques spécifiques à cette régie par type de produit
      </p>

      {/* Onglets par type de produit */}
      <Tabs value={activeProductTab} onValueChange={(v) => handleTabChange(v as ProductType)}>
        <TabsList className="w-full grid grid-cols-3">
          {(Object.keys(productConfig) as ProductType[]).map((type) => {
            const cfg = productConfig[type];
            const count = getSurcoutsByProduct(type).filter(s => s.actif).length;
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
          const surcouts = getSurcoutsByProduct(productType);
          
          return (
            <TabsContent key={productType} value={productType} className="space-y-4 mt-4">
              {/* Formulaire ajout surcoût */}
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Catégorie</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={newSurcout.categorie}
                        onChange={(e) => setNewSurcout({ ...newSurcout, categorie: e.target.value })}
                      >
                        {cfg.categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Code</label>
                      <Input
                        placeholder="ex: sol_beton"
                        value={newSurcout.code}
                        onChange={(e) => setNewSurcout({ ...newSurcout, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Nom affiché</label>
                      <Input
                        placeholder="ex: Sol béton"
                        value={newSurcout.nom}
                        onChange={(e) => setNewSurcout({ ...newSurcout, nom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Prix €</label>
                      <Input
                        type="number"
                        value={newSurcout.prix}
                        onChange={(e) => setNewSurcout({ ...newSurcout, prix: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Type calcul</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={newSurcout.type_calcul}
                        onChange={(e) => setNewSurcout({ ...newSurcout, type_calcul: e.target.value })}
                      >
                        {cfg.typeCalculOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleAddSurcout(productType)} 
                    disabled={!newSurcout.code.trim() || !newSurcout.nom.trim() || saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Ajouter le surcoût
                  </Button>
                </CardContent>
              </Card>

              {/* Liste des surcoûts groupés par catégorie */}
              {cfg.categories.map((catConfig) => {
                const surcoutsCategorie = surcouts.filter(s => s.categorie === catConfig.value);
                if (surcoutsCategorie.length === 0) return null;
                
                return (
                  <div key={catConfig.value} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Wrench className="h-3 w-3" />
                      {catConfig.label}
                    </h4>
                    {surcoutsCategorie.map((surcout) => (
                      <Card key={surcout.id} className={`${!surcout.actif ? "opacity-50" : ""} ${surcout.isGlobal ? "border-dashed" : ""}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{surcout.nom}</p>
                                {surcout.isGlobal && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    Par défaut
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{surcout.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-green-600">
                                {surcout.type_calcul === 'par_panneau' 
                                  ? `${formatCurrency(surcout.prix)}/pann.`
                                  : surcout.type_calcul === 'par_m2'
                                  ? `${formatCurrency(surcout.prix)}/m²`
                                  : formatCurrency(surcout.prix)}
                              </span>
                              <Switch 
                                checked={surcout.actif} 
                                onCheckedChange={() => handleToggleSurcoutActif(surcout)}
                              />
                              {!surcout.isGlobal && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="text-destructive h-8 w-8"
                                  onClick={() => handleDeleteSurcout(surcout)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })}

              {surcouts.length === 0 && (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-6 text-center">
                    <cfg.icon className={`h-8 w-8 mx-auto mb-2 ${cfg.color} opacity-50`} />
                    <p className="text-sm text-muted-foreground">
                      Aucun surcoût {cfg.label} configuré
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajoutez des surcoûts pour les proposer dans les études
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground text-center">
            💡 Les surcoûts sont proposés automatiquement lors de la création des études selon le type de produit sélectionné.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
