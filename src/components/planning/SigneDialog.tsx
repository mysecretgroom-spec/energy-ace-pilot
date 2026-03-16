import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TrendingUp, Coins, Clock, Wrench, ChevronDown, ChevronUp, MessageSquare, Sun, Thermometer, Home } from "lucide-react";
import { ttcToHT, getTauxTVAByPuissance } from "@/lib/tva";
import { ProductType, PRODUCT_SHORT_LABELS, PacSubtype, PAC_SUBTYPE_LABELS } from "@/lib/productTypes";

interface Bouquet {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number | null;
  commission_pct: number | null;
  product_type: ProductType | null;
}

interface Surcout {
  id: string;
  nom: string;
  code: string;
  prix: number;
  categorie: string;
  type_calcul: string;
}

interface SigneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etudeId?: string | null;
  regieId?: string | null;
  defaultProductType?: ProductType;
  onConfirm: (data: { 
    puissanceKwc: number; 
    prixTTC: number; 
    bouquetId?: string;
    cqTime?: string;
    surcoutsIds?: string[];
    commentaire?: string;
    productType: ProductType;
    pacSubtype?: PacSubtype;
    surfaceM2?: number;
  }) => Promise<void>;
  updating: boolean;
}

export function SigneDialog({
  open,
  onOpenChange,
  etudeId,
  regieId,
  defaultProductType = "PV",
  onConfirm,
  updating,
}: SigneDialogProps) {
  const [productType, setProductType] = useState<ProductType>(defaultProductType);
  const [pacSubtype, setPacSubtype] = useState<PacSubtype>("air_eau");
  const [surfaceM2, setSurfaceM2] = useState("");
  const [allBouquets, setAllBouquets] = useState<Bouquet[]>([]);
  const [surcouts, setSurcouts] = useState<Surcout[]>([]);
  const [selectedSurcoutsIds, setSelectedSurcoutsIds] = useState<string[]>([]);
  const [mlQuantities, setMlQuantities] = useState<Record<string, number>>({});
  const [selectedBouquetId, setSelectedBouquetId] = useState<string>("");
  const [puissance, setPuissance] = useState("");
  const [prixTTC, setPrixTTC] = useState("");
  const [prixHT, setPrixHT] = useState("");
  const [cqTime, setCqTime] = useState("10:00");
  const [commentaire, setCommentaire] = useState("");
  const [surcoutsOpen, setSurcoutsOpen] = useState(false);
  const [loadingBouquets, setLoadingBouquets] = useState(false);
  const [loadingEtude, setLoadingEtude] = useState(false);

  // Filter bouquets by selected product type
  const bouquets = useMemo(() => {
    return allBouquets.filter(b => 
      b.product_type === productType || b.product_type === null
    );
  }, [allBouquets, productType]);

  // Fetch bouquets and surcouts on mount — regie-specific + global defaults
  useEffect(() => {
    const fetchData = async () => {
      setLoadingBouquets(true);
      
      if (regieId) {
        // Fetch only bouquets belonging to this regie
        const { data: bouquetsData } = await supabase
          .from("bouquets")
          .select("id, nom_bouquet, puissance_kwc, prix_recommande, commission_fixe, commission_pct, product_type, regie_ids")
          .eq("actif", true)
          .order("puissance_kwc", { ascending: true });

        if (bouquetsData) {
          const regieBouquets = bouquetsData
            .filter(b => b.regie_ids && (b.regie_ids as string[]).includes(regieId))
            .sort((a, b) => a.puissance_kwc - b.puissance_kwc);
          setAllBouquets(regieBouquets as Bouquet[]);
        }

        // Fetch regie-specific AND global default surcouts
        const [regieRes, globalRes] = await Promise.all([
          supabase
            .from("regies_surcouts")
            .select("id, nom, code, prix, categorie, type_calcul")
            .eq("regie_id", regieId)
            .eq("actif", true)
            .order("categorie", { ascending: true }),
          supabase
            .from("regies_surcouts")
            .select("id, nom, code, prix, categorie, type_calcul")
            .is("regie_id", null)
            .eq("actif", true)
            .order("categorie", { ascending: true }),
        ]);
        
        const regieSpecific = regieRes.data || [];
        const globalDefaults = globalRes.data || [];
        
        // Merge: régie-specific takes priority over global defaults (by categorie+code)
        const regieKeys = new Set(regieSpecific.map(s => `${s.categorie}-${s.code}`));
        const nonOverriddenGlobals = globalDefaults.filter(s => !regieKeys.has(`${s.categorie}-${s.code}`));
        
        setSurcouts([...regieSpecific, ...nonOverriddenGlobals]);
      } else {
        // No regie — no bouquets/surcouts available
        setAllBouquets([]);
        setSurcouts([]);
      
      setLoadingBouquets(false);
    };

    if (open) {
      fetchData();
    }
  }, [open, regieId]);

  // Fetch étude data when dialog opens
  useEffect(() => {
    const fetchEtude = async () => {
      if (!etudeId || !open) return;
      
      setLoadingEtude(true);
      const { data: etude } = await supabase
        .from("etudes")
        .select("puissance_kwc, prix_total")
        .eq("id", etudeId)
        .maybeSingle();

      if (etude) {
        const puissanceVal = etude.puissance_kwc?.toString() || "";
        const prixTTCVal = etude.prix_total?.toString() || "";
        setPuissance(puissanceVal);
        setPrixTTC(prixTTCVal);
        
        // Try to find matching bouquet
        if (etude.puissance_kwc) {
          const matchingBouquet = bouquets.find(b => b.puissance_kwc === etude.puissance_kwc);
          if (matchingBouquet) {
            setSelectedBouquetId(matchingBouquet.id);
          }
        }
        
        // Calculate HT
        if (prixTTCVal && puissanceVal) {
          const ttc = parseFloat(prixTTCVal);
          const puissanceNum = parseFloat(puissanceVal);
          if (!isNaN(ttc) && ttc > 0) {
            const tauxTVA = !isNaN(puissanceNum) && puissanceNum <= 3 ? 0.10 : 0.20;
            setPrixHT((ttc / (1 + tauxTVA)).toFixed(2));
          }
        }
      }
      setLoadingEtude(false);
    };

    fetchEtude();
  }, [etudeId, open, bouquets]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBouquetId("");
      setPuissance("");
      setPrixTTC("");
      setPrixHT("");
      setCqTime("10:00");
      setCommentaire("");
      setSelectedSurcoutsIds([]);
      setMlQuantities({});
      setProductType(defaultProductType);
      setPacSubtype("air_eau");
      setSurfaceM2("");
    }
  }, [open, defaultProductType]);

  // Get selected bouquet
  const selectedBouquet = useMemo(() => {
    return bouquets.find(b => b.id === selectedBouquetId);
  }, [bouquets, selectedBouquetId]);

  // Calculate TVA rate based on power
  const tauxTVA = useMemo(() => {
    const p = parseFloat(puissance);
    return !isNaN(p) && p > 0 ? getTauxTVAByPuissance(p) / 100 : 0.10;
  }, [puissance]);

  // Calculate survente and commission
  // Prix recommandé est en TTC
  // Survente = (prixTTC - prixRecommandéTTC), convertie en HT, puis 50%
  const calculations = useMemo(() => {
    const prixHTNum = parseFloat(prixHT);
    const prixTTCNum = parseFloat(prixTTC);
    if (!selectedBouquet || isNaN(prixHTNum) || prixHTNum <= 0 || isNaN(prixTTCNum)) {
      return null;
    }

    const prixRecommandeTTC = selectedBouquet.prix_recommande || 0;
    
    // Survente TTC = prix vente TTC - prix recommandé TTC
    const surventeTTC = Math.max(0, prixTTCNum - prixRecommandeTTC);
    // Convertir en HT
    const surventeHT = surventeTTC / (1 + tauxTVA);
    // 50% du HT
    const bonusSurvente = surventeHT * 0.50;

    // Commission de base
    let commissionBase = 0;
    if (selectedBouquet.commission_fixe && selectedBouquet.commission_fixe > 0) {
      commissionBase = selectedBouquet.commission_fixe;
    } else if (selectedBouquet.commission_pct && selectedBouquet.commission_pct > 0) {
      commissionBase = prixHTNum * (selectedBouquet.commission_pct / 100);
    }

    const commissionTotale = commissionBase + bonusSurvente;

    return {
      prixRecommande: prixRecommandeTTC,
      surventeTTC,
      surventeHT,
      bonusSurvente,
      commissionBase,
      commissionTotale,
    };
  }, [selectedBouquet, prixHT, prixTTC, tauxTVA]);

  // Handle bouquet selection - prix_recommande is already TTC
  const handleBouquetChange = (bouquetId: string) => {
    setSelectedBouquetId(bouquetId);
    const bouquet = bouquets.find(b => b.id === bouquetId);
    if (bouquet) {
      setPuissance(bouquet.puissance_kwc.toString());
      // prix_recommande is stored as TTC
      const prixTTCValue = bouquet.prix_recommande;
      setPrixTTC(prixTTCValue.toFixed(2));
      // Calculate HT from TTC using the utility function
      const tauxTVAValue = getTauxTVAByPuissance(bouquet.puissance_kwc);
      setPrixHT(ttcToHT(prixTTCValue, tauxTVAValue).toFixed(2));
    }
  };

  // Handle power change
  const handlePuissanceChange = (value: string) => {
    setPuissance(value);
    const puissanceNum = parseFloat(value);
    // Recalculate HT if TTC is set
    if (prixTTC) {
      const ttc = parseFloat(prixTTC);
      if (!isNaN(ttc) && ttc > 0 && !isNaN(puissanceNum) && puissanceNum > 0) {
        const tauxTVAValue = getTauxTVAByPuissance(puissanceNum);
        setPrixHT(ttcToHT(ttc, tauxTVAValue).toFixed(2));
      }
    }
    // Try to find matching bouquet
    if (!isNaN(puissanceNum)) {
      const matchingBouquet = bouquets.find(b => b.puissance_kwc === puissanceNum);
      if (matchingBouquet) {
        setSelectedBouquetId(matchingBouquet.id);
      } else {
        setSelectedBouquetId("");
      }
    }
  };

  // Handle TTC change - calculate HT from TTC
  const handlePrixTTCChange = (value: string) => {
    setPrixTTC(value);
    const ttc = parseFloat(value);
    const puissanceNum = parseFloat(puissance);

    if (!isNaN(ttc) && ttc > 0) {
      const tauxTVAValue = !isNaN(puissanceNum) && puissanceNum > 0 
        ? getTauxTVAByPuissance(puissanceNum) 
        : 10; // Default 10% if no power
      setPrixHT(ttcToHT(ttc, tauxTVAValue).toFixed(2));
    } else {
      setPrixHT("");
    }
  };

  // Handle confirm - validation based on product type
  const handleConfirm = async () => {
    const puissanceNum = parseFloat(puissance);
    const prixTTCNum = parseFloat(prixTTC);
    const surfaceNum = parseFloat(surfaceM2);

    // Validation based on product type
    if (productType === "ITE") {
      if (isNaN(surfaceNum) || surfaceNum <= 0) {
        toast.error("Veuillez saisir une surface valide");
        return;
      }
    } else {
      if (isNaN(puissanceNum) || puissanceNum <= 0) {
        toast.error("Veuillez saisir une puissance valide");
        return;
      }
    }
    
    if (isNaN(prixTTCNum) || prixTTCNum <= 0) {
      toast.error("Veuillez saisir un prix TTC valide");
      return;
    }

    await onConfirm({
      puissanceKwc: puissanceNum,
      prixTTC: prixTTCNum,
      bouquetId: selectedBouquetId || undefined,
      cqTime,
      surcoutsIds: selectedSurcoutsIds.length > 0 ? selectedSurcoutsIds : undefined,
      commentaire: commentaire.trim() || undefined,
      productType,
      pacSubtype: productType === "PAC" ? pacSubtype : undefined,
      surfaceM2: productType === "ITE" && surfaceM2 ? parseFloat(surfaceM2) : undefined,
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const toggleSurcout = (id: string) => {
    setSelectedSurcoutsIds(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id) 
        : [...prev, id]
    );
  };

  // Calculate total surcouts
  const calcSurcoutPrice = (surcout: Surcout) => {
    const puissanceNum = parseFloat(puissance) || 0;
    const surfaceNum = parseFloat(surfaceM2) || 0;
    if (surcout.type_calcul === "par_panneau") return surcout.prix * puissanceNum * 2;
    if (surcout.type_calcul === "par_m2") return surcout.prix * surfaceNum;
    if (surcout.type_calcul === "par_ml") return surcout.prix * (mlQuantities[surcout.id] || 0);
    return surcout.prix;
  };

  const totalSurcouts = useMemo(() => {
    return selectedSurcoutsIds.reduce((total, id) => {
      const surcout = surcouts.find(s => s.id === id);
      if (!surcout) return total;
      return total + calcSurcoutPrice(surcout);
    }, 0);
  }, [selectedSurcoutsIds, surcouts, puissance, surfaceM2, mlQuantities]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto z-[200]">
        <DialogHeader>
          <DialogTitle>✅ Vente signée</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Type Selector */}
          <div className="space-y-2">
            <Label>Type de produit</Label>
            <div className="flex gap-2">
              {(["PV", "PAC", "ITE"] as ProductType[]).map((type) => {
                const Icon = type === "PV" ? Sun : type === "PAC" ? Thermometer : Home;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={productType === type ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setProductType(type);
                      setSelectedBouquetId("");
                    }}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {PRODUCT_SHORT_LABELS[type]}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* PAC Subtype selector */}
          {productType === "PAC" && (
            <div className="space-y-2">
              <Label>Type de PAC</Label>
              <Select value={pacSubtype} onValueChange={(v) => setPacSubtype(v as PacSubtype)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAC_SUBTYPE_LABELS) as [PacSubtype, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Sélectionnez un bouquet ou saisissez les informations manuellement.
          </p>

          {/* Bouquet selector */}
          <div className="space-y-2">
            <Label>Bouquet {PRODUCT_SHORT_LABELS[productType]}</Label>
            <Select
              value={selectedBouquetId}
              onValueChange={handleBouquetChange}
              disabled={loadingBouquets}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingBouquets ? "Chargement..." : `Sélectionner un bouquet ${PRODUCT_SHORT_LABELS[productType]}`} />
              </SelectTrigger>
              <SelectContent className="z-[250]">
                {bouquets.map((bouquet) => (
                  <SelectItem key={bouquet.id} value={bouquet.id}>
                    {bouquet.nom_bouquet} - {bouquet.puissance_kwc} {productType === "ITE" ? "m²" : "kWc"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Puissance (for PV/PAC) or Surface (for ITE) */}
          {productType === "ITE" ? (
            <div className="space-y-2">
              <Label htmlFor="signe-surface">Surface à isoler (m²)</Label>
              <Input
                id="signe-surface"
                type="number"
                step="1"
                min="0"
                placeholder="Ex: 120"
                value={surfaceM2}
                onChange={(e) => setSurfaceM2(e.target.value)}
                disabled={loadingEtude}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="signe-puissance">
                {productType === "PAC" ? "Puissance calorifique (kW)" : "Puissance (kWc)"}
              </Label>
              <Input
                id="signe-puissance"
                type="number"
                step="0.1"
                min="0"
                placeholder={productType === "PAC" ? "Ex: 8.5" : "Ex: 3.0"}
                value={puissance}
                onChange={(e) => handlePuissanceChange(e.target.value)}
                disabled={loadingEtude}
              />
              {productType === "PV" && parseFloat(puissance) > 0 && (
                <p className="text-xs text-muted-foreground">
                  TVA applicable : {tauxTVA * 100}%
                </p>
              )}
            </div>
          )}

          {/* Prix TTC */}
          <div className="space-y-2">
            <Label htmlFor="signe-prixTTC">Prix de vente TTC (€)</Label>
            <Input
              id="signe-prixTTC"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 12000"
              value={prixTTC}
              onChange={(e) => handlePrixTTCChange(e.target.value)}
              disabled={loadingEtude}
            />
          </div>

          {/* Montant HT */}
          {prixHT && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Montant HT :</span>{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(parseFloat(prixHT))} €
                </span>
              </p>
            </div>
          )}

          {/* Heure CQ */}
          <div className="space-y-2">
            <Label htmlFor="signe-cq-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Heure du CQ (lendemain)
            </Label>
            <Input
              id="signe-cq-time"
              type="time"
              value={cqTime}
              onChange={(e) => setCqTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Heure du Contrôle Qualité prévu le lendemain
            </p>
          </div>

          {/* Commentaire optionnel */}
          <div className="space-y-2">
            <Label htmlFor="signe-commentaire" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Commentaire (optionnel)
            </Label>
            <Textarea
              id="signe-commentaire"
              placeholder="Ajouter une note sur cette vente..."
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>

          {/* Surcoûts selection - Collapsible */}
          {surcouts.length > 0 && (
            <Collapsible open={surcoutsOpen} onOpenChange={setSurcoutsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    Surcoûts du projet
                    {selectedSurcoutsIds.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {selectedSurcoutsIds.length}
                      </span>
                    )}
                  </span>
                  {surcoutsOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                  {Object.entries(
                    surcouts.reduce((groups, surcout) => {
                      const cat = surcout.categorie || "general";
                      if (!groups[cat]) groups[cat] = [];
                      groups[cat].push(surcout);
                      return groups;
                    }, {} as Record<string, Surcout[]>)
                  ).map(([categorie, items]) => (
                    <div key={categorie} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {categorie.replace(/_/g, " ")}
                      </p>
                      {items.map((surcout) => {
                        const calculatedPrice = calcSurcoutPrice(surcout);
                        const isSelected = selectedSurcoutsIds.includes(surcout.id);
                        const puissanceNum = parseFloat(puissance) || 0;
                        const surfaceNum = parseFloat(surfaceM2) || 0;
                        const nbPanneaux = Math.round(puissanceNum * 2);
                        
                        // Build descriptive label for variable surcoûts
                        const getTypeLabel = () => {
                          if (surcout.type_calcul === "par_panneau") {
                            return nbPanneaux > 0 
                              ? `(${surcout.prix}€ × ${nbPanneaux} pan.)` 
                              : `(${surcout.prix}€/panneau)`;
                          }
                          if (surcout.type_calcul === "par_m2") {
                            return surfaceNum > 0
                              ? `(${surcout.prix}€ × ${surfaceNum} m²)`
                              : `(${surcout.prix}€/m²)`;
                          }
                          if (surcout.type_calcul === "par_ml") {
                            const qty = mlQuantities[surcout.id] || 0;
                            return qty > 0
                              ? `(${surcout.prix}€ × ${qty} ml)`
                              : `(${surcout.prix}€/ml)`;
                          }
                          return null;
                        };

                        const typeLabel = getTypeLabel();
                        
                        return (
                          <div key={surcout.id} className="space-y-1">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`surcout-${surcout.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleSurcout(surcout.id)}
                              />
                              <label
                                htmlFor={`surcout-${surcout.id}`}
                                className="flex-1 text-sm cursor-pointer flex justify-between items-center"
                              >
                                <span>
                                  {surcout.nom}
                                  {typeLabel && (
                                    <span className="text-xs text-muted-foreground ml-1">{typeLabel}</span>
                                  )}
                                </span>
                                <span className="text-muted-foreground font-medium whitespace-nowrap ml-2">
                                  +{formatCurrency(calculatedPrice)} €
                                </span>
                              </label>
                            </div>
                            {surcout.type_calcul === "par_ml" && isSelected && (
                              <div className="ml-9">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder="Nb mètres linéaires"
                                  className="h-7 text-xs w-32"
                                  value={mlQuantities[surcout.id] || ""}
                                  onChange={(e) => setMlQuantities(prev => ({
                                    ...prev,
                                    [surcout.id]: parseFloat(e.target.value) || 0,
                                  }))}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {selectedSurcoutsIds.length > 0 && (
                  <div className="flex justify-between text-sm font-medium p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <span>Total surcoûts</span>
                    <span className="text-orange-600 dark:text-orange-400">
                      +{formatCurrency(totalSurcouts)} €
                    </span>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Commission preview */}
          {calculations && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Coins className="h-4 w-4" />
                <span>Estimation commission</span>
              </div>

              <div className="space-y-2 text-sm">
                {/* Commission base */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Commission bouquet</span>
                  <span>{formatCurrency(calculations.commissionBase)} €</span>
                </div>

                {/* Survente */}
                {calculations.surventeTTC > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Survente TTC
                      </span>
                      <span>+{formatCurrency(calculations.surventeTTC)} €</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>→ Survente HT</span>
                      <span>+{formatCurrency(calculations.surventeHT)} €</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Bonus survente (50%)</span>
                      <span>+{formatCurrency(calculations.bonusSurvente)} €</span>
                    </div>
                  </>
                )}

                {/* Total */}
                <div className="flex justify-between font-semibold pt-2 border-t border-primary/20">
                  <span>Commission totale</span>
                  <span className="text-primary">
                    {formatCurrency(calculations.commissionTotale)} €
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(productType === "ITE" ? !surfaceM2 : !puissance) || !prixTTC || updating}
            className="bg-green-600 hover:bg-green-700"
          >
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer la vente {PRODUCT_SHORT_LABELS[productType]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
