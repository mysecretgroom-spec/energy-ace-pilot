import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Copy, Building2, Euro, Wrench, CreditCard, Check } from "lucide-react";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  is_hejja: boolean;
}

interface CreateRegieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHejja?: boolean;
  existingRegies: Regie[];
  onSuccess: (newRegie: any) => void;
}

const colorOptions = [
  "#0066CC", "#00A86B", "#FF6B35", "#9B59B6", "#E74C3C", "#3498DB", "#F39C12", "#1ABC9C"
];

export function CreateRegieDialog({
  open,
  onOpenChange,
  isHejja = false,
  existingRegies,
  onSuccess,
}: CreateRegieDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [nom, setNom] = useState("");
  const [couleur, setCouleur] = useState("#0066CC");
  const [cloneFromId, setCloneFromId] = useState<string>("");
  const [cloneOptions, setCloneOptions] = useState({
    bouquets: true,
    financements: true,
    surcouts: true,
  });
  const [cloneProgress, setCloneProgress] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNom("");
      setCouleur(isHejja ? "#E74C3C" : "#0066CC");
      setCloneFromId("");
      setCloneOptions({ bouquets: true, financements: true, surcouts: true });
      setCloneProgress(null);
    }
  }, [open, isHejja]);

  // Show all regies for cloning (user can choose any regie's configuration)
  const clonableRegies = existingRegies;

  const handleCreate = async () => {
    if (!user || !nom.trim()) {
      toast.error("Le nom de la régie est requis");
      return;
    }

    setSaving(true);
    try {
      // 1. Create the new regie
      setCloneProgress("Création de la régie...");
      const { data: newRegie, error: createError } = await supabase
        .from("regies")
        .insert({
          user_id: user.id,
          nom: nom.trim(),
          couleur,
          is_hejja: isHejja,
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === "23505") {
          toast.error("Une régie avec ce nom existe déjà");
        } else {
          throw createError;
        }
        return;
      }

      // 2. Clone configuration if source regie selected
      if (cloneFromId && newRegie) {
        const sourceRegie = existingRegies.find(r => r.id === cloneFromId);
        
        // Clone bouquets
        if (cloneOptions.bouquets) {
          setCloneProgress("Copie des tarifs/bouquets...");
          const { data: sourceBouquets } = await supabase
            .from("bouquets")
            .select("*")
            .contains("regie_ids", [cloneFromId]);

          if (sourceBouquets && sourceBouquets.length > 0) {
            // For each bouquet, either add the new regie to regie_ids or create new bouquets
            for (const bouquet of sourceBouquets) {
              // Create new bouquet with the new regie_id
              await supabase.from("bouquets").insert({
                user_id: user.id,
                nom_bouquet: bouquet.nom_bouquet,
                puissance_kwc: bouquet.puissance_kwc,
                prix_recommande: bouquet.prix_recommande,
                prix_max: bouquet.prix_max,
                prix_hejja: bouquet.prix_hejja,
                commission_fixe: bouquet.commission_fixe,
                commission_pct: bouquet.commission_pct,
                description: bouquet.description,
                regie_ids: [newRegie.id],
                actif: true,
              });
            }
          }
        }

        // Clone financements
        if (cloneOptions.financements) {
          setCloneProgress("Copie des financements...");
          const { data: sourceFinancements } = await supabase
            .from("regies_financements")
            .select("*")
            .eq("regie_id", cloneFromId);

          if (sourceFinancements && sourceFinancements.length > 0) {
            const financementsToInsert = sourceFinancements.map(f => ({
              user_id: user.id,
              regie_id: newRegie.id,
              nom: f.nom,
              duree_mois: f.duree_mois,
              taux_effectif: f.taux_effectif,
              taeg: f.taeg,
              actif: f.actif,
            }));
            await supabase.from("regies_financements").insert(financementsToInsert);
          }
        }

        // Clone surcouts
        if (cloneOptions.surcouts) {
          setCloneProgress("Copie des surcoûts...");
          const { data: sourceSurcouts } = await supabase
            .from("regies_surcouts")
            .select("*")
            .eq("regie_id", cloneFromId);

          if (sourceSurcouts && sourceSurcouts.length > 0) {
            const surcoutsToInsert = sourceSurcouts.map(s => ({
              user_id: user.id,
              regie_id: newRegie.id,
              categorie: s.categorie,
              code: s.code,
              nom: s.nom,
              prix: s.prix,
              type_calcul: s.type_calcul,
              actif: s.actif,
            }));
            await supabase.from("regies_surcouts").insert(surcoutsToInsert);
          }
        }

        toast.success(
          `Régie créée avec la configuration de "${sourceRegie?.nom}"`,
          { description: "Bouquets, financements et surcoûts copiés" }
        );
      } else {
        toast.success(isHejja ? "Régie HEJJA créée" : "Régie créée");
      }

      onOpenChange(false);
      onSuccess(newRegie);
    } catch (error) {
      console.error("Error creating regie:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
      setCloneProgress(null);
    }
  };

  const hasCloneSource = cloneFromId !== "";
  const anyCloneOptionEnabled = cloneOptions.bouquets || cloneOptions.financements || cloneOptions.surcouts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isHejja ? "Nouvelle Régie HEJJA" : "Nouvelle Régie"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nom */}
          <div className="space-y-2">
            <Label>Nom de la régie</Label>
            <Input
              placeholder={isHejja ? "Ex: HEJJA Nord..." : "Ex: EDF ENR, Engie Solar..."}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
            />
          </div>

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

          {/* Clone configuration section */}
          {clonableRegies.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Copier la configuration d'une régie existante</Label>
              </div>

              <Select value={cloneFromId} onValueChange={setCloneFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une régie source (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune - Configuration vide</SelectItem>
                  {clonableRegies.map((regie) => (
                    <SelectItem key={regie.id} value={regie.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: regie.couleur }}
                        />
                        {regie.nom}
                        {regie.is_hejja && (
                          <Badge variant="destructive" className="text-[10px] h-4">
                            HEJJA
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clone options */}
              {hasCloneSource && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-2">
                    Éléments à copier :
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Tarifs / Bouquets</span>
                    </div>
                    <Switch
                      checked={cloneOptions.bouquets}
                      onCheckedChange={(checked) =>
                        setCloneOptions({ ...cloneOptions, bouquets: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Financements</span>
                    </div>
                    <Switch
                      checked={cloneOptions.financements}
                      onCheckedChange={(checked) =>
                        setCloneOptions({ ...cloneOptions, financements: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Surcoûts</span>
                    </div>
                    <Switch
                      checked={cloneOptions.surcouts}
                      onCheckedChange={(checked) =>
                        setCloneOptions({ ...cloneOptions, surcouts: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress indicator */}
          {cloneProgress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              {cloneProgress}
            </div>
          )}

          {/* Create button */}
          <Button
            className={`w-full ${isHejja ? "bg-red-500 hover:bg-red-600" : ""}`}
            onClick={handleCreate}
            disabled={saving || !nom.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Création en cours...
              </>
            ) : (
              <>
                Créer la régie
                {hasCloneSource && anyCloneOptionEnabled && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    + config copiée
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
