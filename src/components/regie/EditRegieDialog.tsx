import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Building2, Check } from "lucide-react";
import { SiretSearchField } from "./SiretSearchField";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  siret: string | null;
  is_hejja: boolean;
  logo_url?: string | null;
  actif?: boolean;
  created_at?: string;
  mode_calcul_commission?: string;
  part_survente_pct?: number;
}

interface EditRegieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regie: Regie;
  onSuccess: (updatedRegie: Regie) => void;
}

const colorOptions = [
  "#0066CC", "#00A86B", "#FF6B35", "#9B59B6", "#E74C3C", "#3498DB", "#F39C12", "#1ABC9C"
];

export function EditRegieDialog({
  open,
  onOpenChange,
  regie,
  onSuccess,
}: EditRegieDialogProps) {
  const [saving, setSaving] = useState(false);
  const [nom, setNom] = useState("");
  const [siret, setSiret] = useState("");
  const [couleur, setCouleur] = useState("#0066CC");

  // Reset form when dialog opens
  useEffect(() => {
    if (open && regie) {
      setNom(regie.nom);
      setSiret(regie.siret || "");
      setCouleur(regie.couleur);
    }
  }, [open, regie]);

  const handleSave = async () => {
    if (!nom.trim()) {
      toast.error("Le nom de la régie est requis");
      return;
    }

    // SIRET validation: either empty or exactly 14 digits
    if (siret && siret.length !== 14) {
      toast.error("Le SIRET doit contenir 14 chiffres");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("regies")
        .update({
          nom: nom.trim(),
          siret: siret || null,
          couleur,
        })
        .eq("id", regie.id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Une régie avec ce nom existe déjà");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Régie mise à jour");
      onOpenChange(false);
      onSuccess(data as Regie);
    } catch (error) {
      console.error("Error updating regie:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Modifier la régie
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nom */}
          <div className="space-y-2">
            <Label>Nom de la régie</Label>
            <Input
              placeholder="Ex: EDF ENR, Engie Solar..."
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
            />
          </div>

          {/* SIRET Search with manual entry */}
          <SiretSearchField
            companyName={nom}
            value={siret}
            onChange={(newSiret) => setSiret(newSiret)}
            allowManualEntry
          />

          {/* Couleur */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    couleur === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setCouleur(color)}
                >
                  {couleur === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || !nom.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
