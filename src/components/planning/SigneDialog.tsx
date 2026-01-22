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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, Coins } from "lucide-react";

interface Bouquet {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_hejja: number;
  prix_max: number;
  commission_fixe: number | null;
  commission_pct: number | null;
}

interface SigneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etudeId?: string | null;
  onConfirm: (data: { puissanceKwc: number; prixTTC: number; bouquetId?: string }) => Promise<void>;
  updating: boolean;
}

export function SigneDialog({
  open,
  onOpenChange,
  etudeId,
  onConfirm,
  updating,
}: SigneDialogProps) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [selectedBouquetId, setSelectedBouquetId] = useState<string>("");
  const [puissance, setPuissance] = useState("");
  const [prixTTC, setPrixTTC] = useState("");
  const [prixHT, setPrixHT] = useState("");
  const [loadingBouquets, setLoadingBouquets] = useState(false);
  const [loadingEtude, setLoadingEtude] = useState(false);

  // Fetch bouquets on mount
  useEffect(() => {
    const fetchBouquets = async () => {
      setLoadingBouquets(true);
      const { data, error } = await supabase
        .from("data_prix_bouquets")
        .select("*")
        .eq("actif", true)
        .order("puissance_kwc", { ascending: true });

      if (!error && data) {
        setBouquets(data);
      }
      setLoadingBouquets(false);
    };

    if (open) {
      fetchBouquets();
    }
  }, [open]);

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
    }
  }, [open]);

  // Get selected bouquet
  const selectedBouquet = useMemo(() => {
    return bouquets.find(b => b.id === selectedBouquetId);
  }, [bouquets, selectedBouquetId]);

  // Calculate TVA rate
  const tauxTVA = useMemo(() => {
    const p = parseFloat(puissance);
    return !isNaN(p) && p <= 3 ? 0.10 : 0.20;
  }, [puissance]);

  // Calculate survente and commission
  const calculations = useMemo(() => {
    const prixHTNum = parseFloat(prixHT);
    if (!selectedBouquet || isNaN(prixHTNum) || prixHTNum <= 0) {
      return null;
    }

    const prixHejja = selectedBouquet.prix_hejja || 0;
    const surventeHT = Math.max(0, prixHTNum - prixHejja);
    const bonusSurvente = surventeHT * 0.50; // 50% de la différence

    // Commission de base
    let commissionBase = 0;
    if (selectedBouquet.commission_fixe && selectedBouquet.commission_fixe > 0) {
      commissionBase = selectedBouquet.commission_fixe;
    } else if (selectedBouquet.commission_pct && selectedBouquet.commission_pct > 0) {
      commissionBase = prixHTNum * (selectedBouquet.commission_pct / 100);
    }

    const commissionTotale = commissionBase + bonusSurvente;

    return {
      prixHejja,
      prixRecommande: selectedBouquet.prix_recommande,
      surventeHT,
      bonusSurvente,
      commissionBase,
      commissionTotale,
    };
  }, [selectedBouquet, prixHT]);

  // Handle bouquet selection
  const handleBouquetChange = (bouquetId: string) => {
    setSelectedBouquetId(bouquetId);
    const bouquet = bouquets.find(b => b.id === bouquetId);
    if (bouquet) {
      setPuissance(bouquet.puissance_kwc.toString());
      // Pre-fill with recommended price
      const tauxTVA = bouquet.puissance_kwc <= 3 ? 0.10 : 0.20;
      const ttc = bouquet.prix_recommande * (1 + tauxTVA);
      setPrixTTC(ttc.toFixed(2));
      setPrixHT(bouquet.prix_recommande.toFixed(2));
    }
  };

  // Handle power change
  const handlePuissanceChange = (value: string) => {
    setPuissance(value);
    // Recalculate HT if TTC is set
    if (prixTTC) {
      const ttc = parseFloat(prixTTC);
      const puissanceNum = parseFloat(value);
      if (!isNaN(ttc) && ttc > 0) {
        const tauxTVA = !isNaN(puissanceNum) && puissanceNum <= 3 ? 0.10 : 0.20;
        setPrixHT((ttc / (1 + tauxTVA)).toFixed(2));
      }
    }
    // Try to find matching bouquet
    const puissanceNum = parseFloat(value);
    if (!isNaN(puissanceNum)) {
      const matchingBouquet = bouquets.find(b => b.puissance_kwc === puissanceNum);
      if (matchingBouquet) {
        setSelectedBouquetId(matchingBouquet.id);
      } else {
        setSelectedBouquetId("");
      }
    }
  };

  // Handle TTC change
  const handlePrixTTCChange = (value: string) => {
    setPrixTTC(value);
    const ttc = parseFloat(value);
    const puissanceNum = parseFloat(puissance);

    if (!isNaN(ttc) && ttc > 0) {
      const tauxTVA = !isNaN(puissanceNum) && puissanceNum <= 3 ? 0.10 : 0.20;
      setPrixHT((ttc / (1 + tauxTVA)).toFixed(2));
    } else {
      setPrixHT("");
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    const puissanceNum = parseFloat(puissance);
    const prixTTCNum = parseFloat(prixTTC);

    if (isNaN(puissanceNum) || puissanceNum <= 0) {
      toast.error("Veuillez saisir une puissance valide");
      return;
    }
    if (isNaN(prixTTCNum) || prixTTCNum <= 0) {
      toast.error("Veuillez saisir un prix TTC valide");
      return;
    }

    await onConfirm({
      puissanceKwc: puissanceNum,
      prixTTC: prixTTCNum,
      bouquetId: selectedBouquetId || undefined,
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✅ Vente signée</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Sélectionnez un bouquet ou saisissez les informations manuellement.
          </p>

          {/* Bouquet selector */}
          <div className="space-y-2">
            <Label>Bouquet</Label>
            <Select
              value={selectedBouquetId}
              onValueChange={handleBouquetChange}
              disabled={loadingBouquets}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingBouquets ? "Chargement..." : "Sélectionner un bouquet"} />
              </SelectTrigger>
              <SelectContent>
                {bouquets.map((bouquet) => (
                  <SelectItem key={bouquet.id} value={bouquet.id}>
                    {bouquet.nom_bouquet} - {bouquet.puissance_kwc} kWc
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Puissance */}
          <div className="space-y-2">
            <Label htmlFor="signe-puissance">Puissance (kWc)</Label>
            <Input
              id="signe-puissance"
              type="number"
              step="0.1"
              min="0"
              placeholder="Ex: 3.0"
              value={puissance}
              onChange={(e) => handlePuissanceChange(e.target.value)}
              disabled={loadingEtude}
            />
            {parseFloat(puissance) > 0 && (
              <p className="text-xs text-muted-foreground">
                TVA applicable : {tauxTVA * 100}%
              </p>
            )}
          </div>

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

          {/* Commission preview */}
          {calculations && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Coins className="h-4 w-4" />
                <span>Estimation commission</span>
              </div>

              <div className="space-y-2 text-sm">
                {/* Prix Hejja reference */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Prix HEJJA (référence)</span>
                  <span>{formatCurrency(calculations.prixHejja)} €</span>
                </div>

                {/* Commission base */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Commission bouquet</span>
                  <span>{formatCurrency(calculations.commissionBase)} €</span>
                </div>

                {/* Survente */}
                {calculations.surventeHT > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Survente HT
                      </span>
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
            disabled={!puissance || !prixTTC || updating}
            className="bg-green-600 hover:bg-green-700"
          >
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer la vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
