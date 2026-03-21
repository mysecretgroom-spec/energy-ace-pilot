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
import { Loader2, Wrench, ChevronDown, ChevronUp, Sun, Thermometer, Home } from "lucide-react";
import { ttcToHT, getTauxTVAByPuissance } from "@/lib/tva";
import { ProductType, PRODUCT_SHORT_LABELS, PacSubtype, PAC_SUBTYPE_LABELS } from "@/lib/productTypes";
import { useAuth } from "@/hooks/useAuth";

const SURCOUT_CATEGORIES_BY_PRODUCT: Record<ProductType, string[]> = {
  PV: ["support", "emplacement_boitier", "compteur"],
  PAC: ["type_pac", "installation", "accessoires"],
  ITE: ["finition", "complexite", "accessoires_ite"],
};

interface Bouquet {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
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

interface QuickR2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rdvId: string;
  clientId: string;
  etudeId?: string | null;
  regieId?: string | null;
  onComplete?: () => void;
}

export function QuickR2Dialog({
  open,
  onOpenChange,
  rdvId,
  clientId,
  etudeId,
  regieId,
  onComplete,
}: QuickR2DialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [productType, setProductType] = useState<ProductType>("PV");
  const [pacSubtype, setPacSubtype] = useState<PacSubtype>("air_eau");
  const [surfaceM2, setSurfaceM2] = useState("");
  const [allBouquets, setAllBouquets] = useState<Bouquet[]>([]);
  const [surcouts, setSurcouts] = useState<Surcout[]>([]);
  const [selectedSurcoutsIds, setSelectedSurcoutsIds] = useState<string[]>([]);
  const [mlQuantities, setMlQuantities] = useState<Record<string, number>>({});
  const [selectedBouquetId, setSelectedBouquetId] = useState("");
  const [puissance, setPuissance] = useState("");
  const [prixTTC, setPrixTTC] = useState("");
  const [prixHT, setPrixHT] = useState("");
  const [surcoutsOpen, setSurcoutsOpen] = useState(false);
  const [loadingBouquets, setLoadingBouquets] = useState(false);

  const bouquets = useMemo(() => {
    return allBouquets.filter(b => b.product_type === productType || b.product_type === null);
  }, [allBouquets, productType]);

  const filteredSurcouts = useMemo(() => {
    const allowedCategories = SURCOUT_CATEGORIES_BY_PRODUCT[productType] || [];
    return surcouts.filter(s => allowedCategories.includes(s.categorie));
  }, [surcouts, productType]);

  // Fetch bouquets + surcouts
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoadingBouquets(true);
      let resolvedRegieId = regieId;
      if (!resolvedRegieId && clientId) {
        const { data: c } = await supabase.from("clients").select("regie_id").eq("id", clientId).maybeSingle();
        resolvedRegieId = c?.regie_id || null;
      }
      if (resolvedRegieId) {
        const [bRes, sRes] = await Promise.all([
          supabase.from("bouquets").select("id, nom_bouquet, puissance_kwc, prix_recommande, product_type, regie_ids").eq("actif", true).order("puissance_kwc"),
          supabase.from("regies_surcouts").select("id, nom, code, prix, categorie, type_calcul").eq("regie_id", resolvedRegieId).eq("actif", true).order("categorie"),
        ]);
        if (bRes.data) {
          setAllBouquets(bRes.data.filter(b => b.regie_ids && (b.regie_ids as string[]).includes(resolvedRegieId!)) as Bouquet[]);
        }
        setSurcouts(sRes.data || []);
      } else {
        setAllBouquets([]);
        setSurcouts([]);
      }
      setLoadingBouquets(false);
    };
    fetchData();
  }, [open, regieId, clientId]);

  // Pre-fill from existing étude
  useEffect(() => {
    if (!open || !etudeId) return;
    const fetch = async () => {
      const { data: etude } = await supabase
        .from("etudes")
        .select("puissance_kwc, prix_total, product_type, pac_subtype")
        .eq("id", etudeId)
        .maybeSingle();
      if (etude) {
        if (etude.product_type) setProductType(etude.product_type as ProductType);
        if (etude.pac_subtype) setPacSubtype(etude.pac_subtype as PacSubtype);
        if (etude.puissance_kwc) {
          setPuissance(etude.puissance_kwc.toString());
          const p = etude.puissance_kwc;
          if (etude.prix_total) {
            setPrixTTC(etude.prix_total.toString());
            setPrixHT(ttcToHT(etude.prix_total, getTauxTVAByPuissance(p)).toFixed(2));
          }
        }
      }
    };
    fetch();
  }, [open, etudeId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedBouquetId("");
      setPuissance("");
      setPrixTTC("");
      setPrixHT("");
      setSelectedSurcoutsIds([]);
      setMlQuantities({});
      setProductType("PV");
      setPacSubtype("air_eau");
      setSurfaceM2("");
    }
  }, [open]);

  const handleBouquetChange = (bouquetId: string) => {
    setSelectedBouquetId(bouquetId);
    const bouquet = bouquets.find(b => b.id === bouquetId);
    if (bouquet) {
      setPuissance(bouquet.puissance_kwc.toString());
      setPrixTTC(bouquet.prix_recommande.toFixed(2));
      setPrixHT(ttcToHT(bouquet.prix_recommande, getTauxTVAByPuissance(bouquet.puissance_kwc)).toFixed(2));
    }
  };

  const handlePuissanceChange = (value: string) => {
    setPuissance(value);
    const p = parseFloat(value);
    if (prixTTC) {
      const ttc = parseFloat(prixTTC);
      if (!isNaN(ttc) && ttc > 0 && !isNaN(p) && p > 0) {
        setPrixHT(ttcToHT(ttc, getTauxTVAByPuissance(p)).toFixed(2));
      }
    }
    if (!isNaN(p)) {
      const match = bouquets.find(b => b.puissance_kwc === p);
      setSelectedBouquetId(match?.id || "");
    }
  };

  const handlePrixTTCChange = (value: string) => {
    setPrixTTC(value);
    const ttc = parseFloat(value);
    const p = parseFloat(puissance);
    if (!isNaN(ttc) && ttc > 0) {
      const tva = !isNaN(p) && p > 0 ? getTauxTVAByPuissance(p) : 10;
      setPrixHT(ttcToHT(ttc, tva).toFixed(2));
    } else {
      setPrixHT("");
    }
  };

  const calcSurcoutPrice = (surcout: Surcout) => {
    const p = parseFloat(puissance) || 0;
    const s = parseFloat(surfaceM2) || 0;
    if (surcout.type_calcul === "par_panneau") return surcout.prix * p * 2;
    if (surcout.type_calcul === "par_m2") return surcout.prix * s;
    if (surcout.type_calcul === "par_ml") return surcout.prix * (mlQuantities[surcout.id] || 0);
    return surcout.prix;
  };

  const totalSurcouts = useMemo(() => {
    return selectedSurcoutsIds.reduce((total, id) => {
      const sc = filteredSurcouts.find(s => s.id === id);
      return sc ? total + calcSurcoutPrice(sc) : total;
    }, 0);
  }, [selectedSurcoutsIds, filteredSurcouts, puissance, surfaceM2, mlQuantities]);

  const handleSave = async () => {
    if (!user) return;
    const puissanceNum = parseFloat(puissance);
    const prixTTCNum = parseFloat(prixTTC);

    if (productType === "ITE") {
      const surfaceNum = parseFloat(surfaceM2);
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

    setSaving(true);
    try {
      // Build surcouts JSON for storage
      const surcoutsData = selectedSurcoutsIds.map(id => {
        const sc = filteredSurcouts.find(s => s.id === id);
        return sc ? { id: sc.id, nom: sc.nom, code: sc.code, prix: calcSurcoutPrice(sc) } : null;
      }).filter(Boolean);

      const etudeUpdate: Record<string, unknown> = {
        puissance_kwc: productType !== "ITE" ? puissanceNum : null,
        prix_total: prixTTCNum,
        prix_installation: parseFloat(prixHT) || null,
        product_type: productType,
        surcouts: surcoutsData.length > 0 ? surcoutsData : null,
        autre_surcout: totalSurcouts > 0 ? totalSurcouts : null,
      };
      if (productType === "PAC") {
        etudeUpdate.pac_subtype = pacSubtype;
      }
      if (productType === "ITE") {
        etudeUpdate.ite_surface_isoler = parseFloat(surfaceM2) || null;
      }

      if (etudeId) {
        // Update existing étude
        const { error } = await supabase
          .from("etudes")
          .update(etudeUpdate)
          .eq("id", etudeId);
        if (error) throw error;
      } else {
        // Create new étude linked to this RDV + client
        const { error } = await supabase
          .from("etudes")
          .insert({
            ...etudeUpdate,
            user_id: user.id,
            client_id: clientId,
            rdv_id: rdvId,
            classification: "r2",
          });
        if (error) throw error;
      }

      toast.success("Infos R2 enregistrées");
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      console.error("Error saving R2 quick info:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto z-[200]">
        <DialogHeader>
          <DialogTitle>📋 Infos rapides R2</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Renseignez les infos clés pour préparer le R2 sans remplir l'étude complète.
          </p>

          {/* Product Type */}
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
                      setSelectedSurcoutsIds([]);
                      setMlQuantities({});
                    }}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {PRODUCT_SHORT_LABELS[type]}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* PAC Subtype */}
          {productType === "PAC" && (
            <div className="space-y-2">
              <Label>Type de PAC</Label>
              <Select value={pacSubtype} onValueChange={(v) => setPacSubtype(v as PacSubtype)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAC_SUBTYPE_LABELS) as [PacSubtype, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Bouquet selector */}
          {bouquets.length > 0 && (
            <div className="space-y-2">
              <Label>Bouquet</Label>
              <Select value={selectedBouquetId} onValueChange={handleBouquetChange} disabled={loadingBouquets}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingBouquets ? "Chargement..." : "Sélectionner un bouquet"} />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  {bouquets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nom_bouquet} - {b.puissance_kwc} {productType === "ITE" ? "m²" : "kWc"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Puissance / Surface */}
          {productType === "ITE" ? (
            <div className="space-y-2">
              <Label>Surface à isoler (m²)</Label>
              <Input type="number" step="1" min="0" value={surfaceM2} onChange={(e) => setSurfaceM2(e.target.value)} placeholder="Ex: 120" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Puissance ({productType === "PAC" ? "kW" : "kWc"})</Label>
              <Input type="number" step="0.5" min="0" value={puissance} onChange={(e) => handlePuissanceChange(e.target.value)} placeholder="Ex: 6" />
            </div>
          )}

          {/* Prix TTC */}
          <div className="space-y-2">
            <Label>Prix TTC (€)</Label>
            <Input type="number" step="100" min="0" value={prixTTC} onChange={(e) => handlePrixTTCChange(e.target.value)} placeholder="Ex: 15000" />
            {prixHT && (
              <p className="text-xs text-muted-foreground">HT: {formatCurrency(parseFloat(prixHT))}€</p>
            )}
          </div>

          {/* Surcoûts */}
          {filteredSurcouts.length > 0 && (
            <Collapsible open={surcoutsOpen} onOpenChange={setSurcoutsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Surcoûts {selectedSurcoutsIds.length > 0 && `(${selectedSurcoutsIds.length})`}
                  </span>
                  {surcoutsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {filteredSurcouts.map((sc) => {
                  const isSelected = selectedSurcoutsIds.includes(sc.id);
                  const price = calcSurcoutPrice(sc);
                  const detailLabel = sc.type_calcul === "par_panneau"
                    ? `${sc.prix}€ × ${Math.round((parseFloat(puissance) || 0) * 2)} pan.`
                    : sc.type_calcul === "par_m2"
                      ? `${sc.prix}€/m²`
                      : sc.type_calcul === "par_ml"
                        ? `${sc.prix}€/ml`
                        : `${sc.prix}€`;

                  return (
                    <div key={sc.id} className="flex items-start gap-2 p-2 rounded-lg border bg-card">
                      <Checkbox
                        id={`r2-sc-${sc.id}`}
                        checked={isSelected}
                        onCheckedChange={() => {
                          setSelectedSurcoutsIds(prev =>
                            prev.includes(sc.id) ? prev.filter(x => x !== sc.id) : [...prev, sc.id]
                          );
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`r2-sc-${sc.id}`} className="text-sm font-medium cursor-pointer block">
                          {sc.nom}
                        </label>
                        <span className="text-xs text-muted-foreground">{detailLabel}</span>
                        {sc.type_calcul === "par_ml" && isSelected && (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="h-7 mt-1 w-24 text-xs"
                            placeholder="ml"
                            value={mlQuantities[sc.id] || ""}
                            onChange={(e) => setMlQuantities(prev => ({ ...prev, [sc.id]: parseFloat(e.target.value) || 0 }))}
                          />
                        )}
                      </div>
                      {isSelected && <span className="text-sm font-semibold text-primary whitespace-nowrap">{formatCurrency(price)}€</span>}
                    </div>
                  );
                })}
                {totalSurcouts > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
                    <span>Total surcoûts</span>
                    <span className="text-primary">{formatCurrency(totalSurcouts)}€</span>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Passer</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
