import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MinusCircle } from "lucide-react";

interface DecomDialogProps {
  venteId: string;
  clientName: string;
  currentDecom: number;
  currentRaison: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const DecomDialog = ({
  venteId,
  clientName,
  currentDecom,
  currentRaison,
  open,
  onOpenChange,
  onSaved,
}: DecomDialogProps) => {
  const [montant, setMontant] = useState(currentDecom.toString());
  const [raison, setRaison] = useState(currentRaison || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const decomValue = parseFloat(montant) || 0;
      
      const { error } = await supabase
        .from("ventes")
        .update({
          decom_montant: decomValue,
          decom_raison: raison || null,
        })
        .eq("id", venteId);

      if (error) throw error;

      toast.success("Décom enregistrée");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur sauvegarde décom:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDecom = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ventes")
        .update({
          decom_montant: 0,
          decom_raison: null,
        })
        .eq("id", venteId);

      if (error) throw error;

      toast.success("Décom supprimée");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur suppression décom:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MinusCircle className="h-5 w-5 text-destructive" />
            Décom - {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decom-montant">Montant de la décommission (€ HT)</Label>
            <Input
              id="decom-montant"
              type="number"
              placeholder="0"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="decom-raison">Raison (optionnel)</Label>
            <Textarea
              id="decom-raison"
              placeholder="Ex: Parrainage, remise commerciale..."
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {currentDecom > 0 && (
            <Button
              variant="outline"
              onClick={handleRemoveDecom}
              disabled={saving}
              className="text-destructive"
            >
              Supprimer
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
