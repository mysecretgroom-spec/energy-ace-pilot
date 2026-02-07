import { useState, useEffect } from "react";
import { Building2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Regie {
  id: string;
  nom: string;
  couleur: string | null;
}

type TargetTable = "rdv" | "clients" | "ventes";

interface RegieSelectorProps {
  /** ID of the record to update */
  rdvId?: string;
  entityId?: string;
  /** Which table to update (default: "rdv" for backward compat) */
  targetTable?: TargetTable;
  currentRegieId?: string | null;
  currentRegieNom?: string | null;
  currentRegieCouleur?: string | null;
  onRegieChange?: (regieId: string | null, regieNom: string | null, regieCouleur: string | null) => void;
  compact?: boolean;
}

export function RegieSelector({
  rdvId,
  entityId,
  targetTable = "rdv",
  currentRegieId,
  currentRegieNom,
  currentRegieCouleur,
  onRegieChange,
  compact = false,
}: RegieSelectorProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const recordId = entityId || rdvId;

  useEffect(() => {
    if (open && user) {
      fetchRegies();
    }
  }, [open, user]);

  const fetchRegies = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("regies")
        .select("id, nom, couleur")
        .eq("user_id", user.id)
        .eq("actif", true)
        .order("nom");

      if (error) throw error;
      setRegies(data || []);
    } catch (err) {
      console.error("Error fetching regies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRegie = async (regie: Regie | null) => {
    if (!recordId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from(targetTable)
        .update({ regie_id: regie?.id || null })
        .eq("id", recordId);

      if (error) throw error;

      toast.success(
        regie ? `Régie "${regie.nom}" attribuée` : "Régie retirée"
      );
      onRegieChange?.(regie?.id || null, regie?.nom || null, regie?.couleur || null);
      setOpen(false);
    } catch (err) {
      console.error("Error updating regie:", err);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className={cn(
            "h-9 w-9 rounded-full transition-all",
            currentRegieId && "border-2"
          )}
          style={{
            borderColor: currentRegieCouleur || undefined,
            backgroundColor: currentRegieCouleur ? `${currentRegieCouleur}15` : undefined,
          }}
          title={currentRegieNom ? `Régie: ${currentRegieNom}` : "Attribuer une régie"}
        >
          <Building2 
            className="h-4 w-4" 
            style={{ color: currentRegieCouleur || undefined }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-1">
            Attribuer une régie
          </p>
          
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : regies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucune régie configurée
            </p>
          ) : (
            <>
              {/* Option pour retirer la régie */}
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 h-9",
                  !currentRegieId && "bg-muted"
                )}
                onClick={() => handleSelectRegie(null)}
                disabled={saving}
              >
                {!currentRegieId && <Check className="h-4 w-4" />}
                <span className={cn(!currentRegieId && "ml-0", currentRegieId && "ml-6")}>
                  Aucune régie
                </span>
              </Button>

              {regies.map((regie) => (
                <Button
                  key={regie.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 h-9",
                    currentRegieId === regie.id && "bg-muted"
                  )}
                  onClick={() => handleSelectRegie(regie)}
                  disabled={saving}
                >
                  {currentRegieId === regie.id && <Check className="h-4 w-4" />}
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0",
                      currentRegieId !== regie.id && "ml-6"
                    )}
                    style={{ backgroundColor: regie.couleur || "#888" }}
                  />
                  <span className="truncate">{regie.nom}</span>
                </Button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
