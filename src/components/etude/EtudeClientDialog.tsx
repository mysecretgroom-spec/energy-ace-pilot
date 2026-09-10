import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface EtudeClientValues {
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  adresseInstallation: string;
  codePostalInstallation: string;
  villeInstallation: string;
}

interface EtudeClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  values: EtudeClientValues;
  onSaved: (values: EtudeClientValues) => void;
}

/**
 * Édition rapide des coordonnées du client depuis l'outil d'étude,
 * avec possibilité de saisir une adresse d'installation différente
 * (chantier hors résidence principale).
 */
export const EtudeClientDialog = ({
  open,
  onOpenChange,
  clientId,
  values,
  onSaved,
}: EtudeClientDialogProps) => {
  const [form, setForm] = useState<EtudeClientValues>(values);
  const [autreAdresse, setAutreAdresse] = useState(Boolean(values.adresseInstallation));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(values);
      setAutreAdresse(Boolean(values.adresseInstallation));
    }
  }, [open, values]);

  const set = (key: keyof EtudeClientValues, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    try {
      if (clientId) {
        const { error } = await supabase
          .from("clients")
          .update({
            nom: form.nom.trim(),
            prenom: form.prenom.trim() || null,
            telephone: form.telephone.trim() || null,
            adresse: form.adresse.trim() || null,
            code_postal: form.codePostal.trim() || null,
            ville: form.ville.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", clientId);
        if (error) throw error;
      }

      onSaved({
        ...form,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim(),
        adresse: form.adresse.trim(),
        codePostal: form.codePostal.trim(),
        ville: form.ville.trim(),
        adresseInstallation: autreAdresse ? form.adresseInstallation.trim() : "",
        codePostalInstallation: autreAdresse ? form.codePostalInstallation.trim() : "",
        villeInstallation: autreAdresse ? form.villeInstallation.trim() : "",
      });
      toast.success("Informations mises à jour");
      onOpenChange(false);
    } catch (error) {
      console.error("[EtudeClientDialog] save failed", error);
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informations client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etude-prenom">Prénom</Label>
              <Input
                id="etude-prenom"
                value={form.prenom}
                onChange={(e) => set("prenom", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etude-nom">Nom *</Label>
              <Input id="etude-nom" value={form.nom} onChange={(e) => set("nom", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etude-tel">Téléphone</Label>
            <Input
              id="etude-tel"
              type="tel"
              value={form.telephone}
              onChange={(e) => set("telephone", e.target.value)}
              placeholder="06 12 34 56 78"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etude-adresse">Adresse</Label>
            <Input
              id="etude-adresse"
              value={form.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              placeholder="12 rue des Lilas"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etude-cp">Code postal</Label>
              <Input
                id="etude-cp"
                value={form.codePostal}
                onChange={(e) => set("codePostal", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etude-ville">Ville</Label>
              <Input
                id="etude-ville"
                value={form.ville}
                onChange={(e) => set("ville", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Installation à une autre adresse</p>
              <p className="text-xs text-muted-foreground">
                Si le chantier n'est pas à la résidence principale
              </p>
            </div>
            <Switch checked={autreAdresse} onCheckedChange={setAutreAdresse} />
          </div>

          {autreAdresse && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="etude-adresse-inst">Adresse d'installation</Label>
                <Input
                  id="etude-adresse-inst"
                  value={form.adresseInstallation}
                  onChange={(e) => set("adresseInstallation", e.target.value)}
                  placeholder="Lieu du chantier"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="etude-cp-inst">Code postal</Label>
                  <Input
                    id="etude-cp-inst"
                    value={form.codePostalInstallation}
                    onChange={(e) => set("codePostalInstallation", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="etude-ville-inst">Ville</Label>
                  <Input
                    id="etude-ville-inst"
                    value={form.villeInstallation}
                    onChange={(e) => set("villeInstallation", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
