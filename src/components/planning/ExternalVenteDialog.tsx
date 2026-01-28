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
import { Loader2, Wrench, Euro, AlertCircle, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Regie {
  id: string;
  nom: string;
  couleur: string | null;
}

interface ExternalVenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  rdvId?: string;
  rdvDate?: string; // Date du RDV pour pré-remplir la date de pose
  regieId?: string | null;
  onSuccess: () => void;
}

export function ExternalVenteDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  rdvId,
  rdvDate,
  regieId,
  onSuccess,
}: ExternalVenteDialogProps) {
  const { user } = useAuth();
  const [commission, setCommission] = useState("");
  const [datePose, setDatePose] = useState(rdvDate || new Date().toISOString().split("T")[0]);
  const [selectedRegieId, setSelectedRegieId] = useState<string | null>(regieId || null);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [loadingRegies, setLoadingRegies] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch regies on open
  useEffect(() => {
    if (open && user) {
      fetchRegies();
    }
  }, [open, user]);

  // Update date and regie when props change
  useEffect(() => {
    if (rdvDate) setDatePose(rdvDate);
  }, [rdvDate]);

  useEffect(() => {
    if (regieId) setSelectedRegieId(regieId);
  }, [regieId]);

  const fetchRegies = async () => {
    if (!user) return;
    setLoadingRegies(true);
    try {
      const { data, error } = await (supabase as any)
        .from("regies")
        .select("id, nom, couleur")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("nom");

      if (error) throw error;
      setRegies(data || []);
    } catch (err) {
      console.error("Error fetching regies:", err);
    } finally {
      setLoadingRegies(false);
    }
  };

  const handleConfirm = async () => {
    const commissionNum = parseFloat(commission);

    if (!selectedRegieId) {
      toast.error("Veuillez sélectionner une régie");
      return;
    }

    if (isNaN(commissionNum) || commissionNum <= 0) {
      toast.error("Veuillez saisir une commission valide");
      return;
    }

    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }

    setSaving(true);
    try {
      // Create the external sale with status "installe" (posé)
      // montant_ht = commission (this IS the commission amount, not a CA)
      // montant_ttc = same value (no real TTC for external)
      const { data: vente, error: venteError } = await supabase
        .from("ventes")
        .insert({
          user_id: user.id,
          client_id: clientId,
          montant_ht: commissionNum, // This represents the commission amount
          montant_ttc: commissionNum, // Same value - no CA for external
          type_vente: 'external_installation',
          status: 'installe', // Starts as "posé", will auto-transition to "attente_paiement"
          date_signature: datePose, // Date de pose
          date_installation_reelle: datePose,
          regie_id: selectedRegieId,
        })
        .select()
        .single();

      if (venteError) throw venteError;

      // Update RDV status to "signe" if we have rdvId
      if (rdvId) {
        await supabase
          .from("rdv")
          .update({ status: 'signe' })
          .eq("id", rdvId);
      }

      toast.success("Vente externe créée avec succès");
      onOpenChange(false);
      setCommission("");
      onSuccess();
    } catch (error) {
      console.error("Error creating external vente:", error);
      toast.error("Erreur lors de la création de la vente");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCommission("");
    setSelectedRegieId(regieId || null);
    setDatePose(rdvDate || new Date().toISOString().split("T")[0]);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const commissionNum = parseFloat(commission);
  const isValid = !isNaN(commissionNum) && commissionNum > 0 && !!selectedRegieId;
  const selectedRegie = regies.find(r => r.id === selectedRegieId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Installation externe
          </DialogTitle>
          <DialogDescription>
            Cette vente ne génère pas de CA, uniquement une commission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Client</p>
            <p className="font-medium">{clientName}</p>
          </div>

          {/* Régie selector (required) */}
          <div className="space-y-2">
            <Label htmlFor="external-regie" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Régie <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedRegieId || ""}
              onValueChange={(value) => setSelectedRegieId(value)}
              disabled={loadingRegies}
            >
              <SelectTrigger id="external-regie">
                <SelectValue placeholder={loadingRegies ? "Chargement..." : "Sélectionner une régie"} />
              </SelectTrigger>
              <SelectContent>
                {regies.map((regie) => (
                  <SelectItem key={regie.id} value={regie.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: regie.couleur || "#888" }} 
                      />
                      {regie.nom}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {regies.length === 0 && !loadingRegies && (
              <p className="text-xs text-destructive">Aucune régie configurée</p>
            )}
          </div>

          {/* Date de pose */}
          <div className="space-y-2">
            <Label htmlFor="external-date-pose">Date de pose</Label>
            <Input
              id="external-date-pose"
              type="date"
              value={datePose}
              onChange={(e) => setDatePose(e.target.value)}
            />
          </div>

          {/* Commission input */}
          <div className="space-y-2">
            <Label htmlFor="external-commission">Commission (€ HT)</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="external-commission"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 500"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Montant que vous facturez pour cette installation
            </p>
          </div>

          {/* Info box */}
          <div className="p-3 bg-amber-500/10 border border-amber-200 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Workflow automatique</p>
                <ul className="mt-1 text-xs space-y-1 text-amber-700">
                  <li>• La vente sera créée au statut "Posé"</li>
                  <li>• Après 2 semaines → "En attente de paiement"</li>
                  <li>• Visible dans le CRM onglet Ventes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview */}
          {isValid && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Commission nette</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(commissionNum)} €
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || saving}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer la vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}