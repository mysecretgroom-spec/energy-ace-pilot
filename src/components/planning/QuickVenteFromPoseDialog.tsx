import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wrench, Euro, Building2, Zap, FileSignature } from "lucide-react";

type VenteType = "standard" | "external_installation";

interface Regie {
  id: string;
  nom: string;
  couleur: string | null;
}

interface QuickVenteFromPoseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  rdvId?: string;
  rdvDate?: string;
  regieId?: string | null;
  onSuccess: () => void;
}

export function QuickVenteFromPoseDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  rdvId,
  rdvDate,
  regieId,
  onSuccess,
}: QuickVenteFromPoseDialogProps) {
  const { user } = useAuth();
  const [typeVente, setTypeVente] = useState<VenteType>("external_installation");
  const [selectedRegieId, setSelectedRegieId] = useState<string | null>(regieId || null);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [datePose, setDatePose] = useState(rdvDate || new Date().toISOString().split("T")[0]);
  const [commission, setCommission] = useState("");
  const [montantTTC, setMontantTTC] = useState("");
  const [montantHT, setMontantHT] = useState("");
  const [puissanceKwc, setPuissanceKwc] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingRegies, setLoadingRegies] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingRegies(true);
    (supabase as any)
      .from("regies")
      .select("id, nom, couleur")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("nom")
      .then(({ data }: any) => {
        setRegies(data || []);
        setLoadingRegies(false);
      });
  }, [open, user]);

  useEffect(() => {
    if (regieId) setSelectedRegieId(regieId);
  }, [regieId]);
  useEffect(() => {
    if (rdvDate) setDatePose(rdvDate);
  }, [rdvDate]);

  // Auto-recalc HT from TTC (TVA 10%)
  useEffect(() => {
    const ttc = parseFloat(montantTTC);
    if (!isNaN(ttc) && ttc > 0) {
      setMontantHT((ttc / 1.1).toFixed(2));
    }
  }, [montantTTC]);

  const reset = () => {
    setCommission("");
    setMontantTTC("");
    setMontantHT("");
    setPuissanceKwc("");
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const isValid = (() => {
    if (!selectedRegieId) return false;
    if (typeVente === "external_installation") {
      const c = parseFloat(commission);
      return !isNaN(c) && c > 0;
    } else {
      const ttc = parseFloat(montantTTC);
      return !isNaN(ttc) && ttc > 0;
    }
  })();

  const handleConfirm = async () => {
    if (!user || !selectedRegieId) {
      toast.error("Régie requise");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        client_id: clientId,
        regie_id: selectedRegieId,
        type_vente: typeVente,
        date_signature: datePose,
      };

      if (typeVente === "external_installation") {
        const c = parseFloat(commission);
        payload.montant_ht = c;
        payload.montant_ttc = c;
        payload.status = "installe";
        payload.date_installation_reelle = datePose;
      } else {
        const ttc = parseFloat(montantTTC);
        const ht = parseFloat(montantHT) || ttc / 1.1;
        payload.montant_ttc = ttc;
        payload.montant_ht = ht;
        payload.puissance_kwc = puissanceKwc ? parseFloat(puissanceKwc) : null;
        payload.status = "signe";
      }

      const { error: venteError } = await supabase.from("ventes").insert(payload);
      if (venteError) throw venteError;

      if (rdvId) {
        await supabase.from("rdv").update({ status: "signe" }).eq("id", rdvId);
      }

      toast.success("Vente créée avec succès");
      handleClose();
      onSuccess();
    } catch (e) {
      console.error("[QuickVenteFromPose]", e);
      toast.error("Erreur lors de la création de la vente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Créer la vente
          </DialogTitle>
          <DialogDescription>Saisie rapide depuis le RDV de pose</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Client</p>
            <p className="font-medium">{clientName}</p>
          </div>

          {/* Type de vente */}
          <div className="space-y-2">
            <Label>Type de vente</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={typeVente === "standard" ? "default" : "outline"}
                onClick={() => setTypeVente("standard")}
                className="h-auto py-3 flex-col gap-1"
              >
                <Zap className="h-4 w-4" />
                <span className="text-xs">Standard</span>
              </Button>
              <Button
                type="button"
                variant={typeVente === "external_installation" ? "default" : "outline"}
                onClick={() => setTypeVente("external_installation")}
                className="h-auto py-3 flex-col gap-1"
              >
                <Wrench className="h-4 w-4" />
                <span className="text-xs">Pose externe</span>
              </Button>
            </div>
          </div>

          {/* Régie */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Régie <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedRegieId || ""}
              onValueChange={(v) => setSelectedRegieId(v)}
              disabled={loadingRegies}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingRegies ? "Chargement..." : "Sélectionner"} />
              </SelectTrigger>
              <SelectContent>
                {regies.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: r.couleur || "#888" }}
                      />
                      {r.nom}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date de pose</Label>
            <Input type="date" value={datePose} onChange={(e) => setDatePose(e.target.value)} />
          </div>

          {/* Champs spécifiques */}
          {typeVente === "external_installation" ? (
            <div className="space-y-2">
              <Label>Commission (€ HT)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 500"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Montant TTC (€)</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 15000"
                    value={montantTTC}
                    onChange={(e) => setMontantTTC(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {montantHT && (
                  <p className="text-xs text-muted-foreground">HT : {montantHT} €</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Puissance (kWc)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 3"
                  value={puissanceKwc}
                  onChange={(e) => setPuissanceKwc(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer la vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
