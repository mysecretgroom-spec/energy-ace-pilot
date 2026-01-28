import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Check, Loader2, Plus, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface RegieConfigStepProps {
  onComplete: () => void;
}

export function RegieConfigStep({ onComplete }: RegieConfigStepProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRegie, setHasRegie] = useState(false);
  const [regieName, setRegieName] = useState("");
  const [formData, setFormData] = useState({
    nom: "",
    ville: "",
  });

  useEffect(() => {
    checkExistingRegie();
  }, [user]);

  const checkExistingRegie = async () => {
    if (!user) return;

    try {
      const { data, count } = await supabase
        .from("regies")
        .select("nom", { count: "exact" })
        .eq("user_id", user.id)
        .limit(1);

      if (count && count > 0 && data?.[0]) {
        setHasRegie(true);
        setRegieName(data[0].nom);
      }
    } catch (error) {
      console.error("Error checking regies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;

    if (!formData.nom.trim()) {
      toast.error("Le nom de la régie est requis");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("regies").insert({
        user_id: user.id,
        nom: formData.nom.trim(),
        ville: formData.ville.trim() || null,
      });

      if (error) throw error;

      toast.success("Régie créée ✓");
      onComplete();
    } catch (error) {
      console.error("Error creating regie:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already has a regie
  if (hasRegie) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="font-medium text-green-700 dark:text-green-400">
            Régie configurée
          </p>
          <p className="text-sm text-green-600/80 mt-1">{regieName}</p>
        </div>
        <Button
          onClick={onComplete}
          className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
        >
          <Check className="h-4 w-4" />
          Continuer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        La régie est l'agence partenaire qui vous envoie les leads. Vous pourrez en ajouter d'autres plus tard.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="regie_nom" className="text-xs flex items-center gap-1.5">
          <Building2 className="h-3 w-3" />
          Nom de la régie *
        </Label>
        <Input
          id="regie_nom"
          placeholder="Ex: ABC Énergie"
          value={formData.nom}
          onChange={(e) => setFormData((s) => ({ ...s, nom: e.target.value }))}
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="regie_ville" className="text-xs flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          Ville (optionnel)
        </Label>
        <Input
          id="regie_ville"
          placeholder="Ex: Lyon"
          value={formData.ville}
          onChange={(e) => setFormData((s) => ({ ...s, ville: e.target.value }))}
          className="h-9 text-sm"
        />
      </div>

      <Button
        onClick={handleCreate}
        disabled={saving || !formData.nom.trim()}
        className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Créer la régie et continuer
      </Button>
    </div>
  );
}
