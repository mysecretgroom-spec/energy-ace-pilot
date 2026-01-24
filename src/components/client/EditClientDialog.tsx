import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ClientData {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  notes: string | null;
  source: string | null;
}

interface EditClientDialogProps {
  client: ClientData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditClientDialog = ({
  client,
  open,
  onOpenChange,
  onSuccess,
}: EditClientDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<ClientData>>({});
  const [originalData, setOriginalData] = useState<Partial<ClientData>>({});

  useEffect(() => {
    if (client) {
      const data = {
        nom: client.nom,
        prenom: client.prenom,
        email: client.email,
        telephone: client.telephone,
        telephone_secondaire: client.telephone_secondaire,
        adresse: client.adresse,
        code_postal: client.code_postal,
        ville: client.ville,
        notes: client.notes,
        source: client.source,
      };
      setFormData(data);
      setOriginalData(data);
    }
  }, [client]);

  // Détecter les modifications
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  const handleChange = (field: keyof ClientData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleSave = async () => {
    if (!client?.id || !formData.nom?.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          nom: formData.nom.trim(),
          prenom: formData.prenom?.trim() || null,
          email: formData.email?.trim() || null,
          telephone: formData.telephone?.trim() || null,
          telephone_secondaire: formData.telephone_secondaire?.trim() || null,
          adresse: formData.adresse?.trim() || null,
          code_postal: formData.code_postal?.trim() || null,
          ville: formData.ville?.trim() || null,
          notes: formData.notes?.trim() || null,
          source: formData.source?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (error) throw error;

      toast.success("Client mis à jour");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={formData.prenom || ""}
                onChange={(e) => handleChange("prenom", e.target.value)}
                placeholder="Prénom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input
                id="nom"
                value={formData.nom || ""}
                onChange={(e) => handleChange("nom", e.target.value)}
                placeholder="Nom"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone principal</Label>
            <Input
              id="telephone"
              type="tel"
              value={formData.telephone || ""}
              onChange={(e) => handleChange("telephone", e.target.value)}
              placeholder="06 12 34 56 78"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telephone_secondaire">Téléphone secondaire</Label>
            <Input
              id="telephone_secondaire"
              type="tel"
              value={formData.telephone_secondaire || ""}
              onChange={(e) => handleChange("telephone_secondaire", e.target.value)}
              placeholder="06 98 76 54 32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="email@exemple.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              value={formData.adresse || ""}
              onChange={(e) => handleChange("adresse", e.target.value)}
              placeholder="123 rue de la Paix"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="code_postal">Code postal</Label>
              <Input
                id="code_postal"
                value={formData.code_postal || ""}
                onChange={(e) => handleChange("code_postal", e.target.value)}
                placeholder="75001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ville">Ville</Label>
              <Input
                id="ville"
                value={formData.ville || ""}
                onChange={(e) => handleChange("ville", e.target.value)}
                placeholder="Paris"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={formData.source || ""}
              onChange={(e) => handleChange("source", e.target.value)}
              placeholder="Origine du contact"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Notes sur le client..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <div 
            className={`transition-all duration-300 ease-out ${
              hasChanges 
                ? "opacity-100 scale-100" 
                : "opacity-0 scale-95 pointer-events-none w-0 overflow-hidden"
            }`}
          >
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
