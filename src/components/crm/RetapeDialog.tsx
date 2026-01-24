import { useState, useEffect } from "react";
import { RefreshCw, Building2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { toast } from "sonner";

interface Regie {
  id: string;
  nom: string;
  couleur: string;
  is_hejja: boolean;
}

interface RetapeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

export function RetapeDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
}: RetapeDialogProps) {
  const { user } = useAuth();
  const { isActive: modeHejjaActive } = useHejjaMode();
  const [regies, setRegies] = useState<Regie[]>([]);
  const [selectedRegieId, setSelectedRegieId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchRegies();
    }
  }, [open, user]);

  const fetchRegies = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("regies")
        .select("id, nom, couleur, is_hejja")
        .eq("user_id", user.id)
        .eq("actif", true)
        .order("nom");

      if (error) throw error;
      
      // Filter regies based on HEJJA mode
      const filteredRegies = (data || []).filter(r => 
        modeHejjaActive ? true : !r.is_hejja
      );
      setRegies(filteredRegies);
    } catch (err) {
      console.error("Error fetching regies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetape = async () => {
    if (!user || !selectedRegieId) {
      toast.error("Veuillez sélectionner une régie");
      return;
    }

    setSaving(true);
    try {
      // First, fetch the original client data
      const { data: originalClient, error: fetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (fetchError) throw fetchError;

      // Create a duplicate client with retape flag
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          nom: originalClient.nom,
          prenom: originalClient.prenom,
          email: originalClient.email,
          telephone: originalClient.telephone,
          telephone_secondaire: originalClient.telephone_secondaire,
          adresse: originalClient.adresse,
          code_postal: originalClient.code_postal,
          ville: originalClient.ville,
          latitude: originalClient.latitude,
          longitude: originalClient.longitude,
          notes: `[RETAPE] Copie de ${originalClient.nom} ${originalClient.prenom || ""}`.trim(),
          source: "retape",
          regie_id: selectedRegieId,
          is_retape: true,
          retape_original_id: clientId,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Create a new RDV for the duplicated client
      const { error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id: user.id,
          client_id: newClient.id,
          regie_id: selectedRegieId,
          date_heure: new Date().toISOString(),
          status: "nouveau",
          type_rdv: "standard",
          type_projet: "photovoltaique",
          commentaire: "[RETAPE] Relance commerciale",
          source: "retape",
        });

      if (rdvError) throw rdvError;

      toast.success("Client retape créé avec succès");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("Error creating retape:", err);
      toast.error("Erreur lors de la création de la retape");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            Retape Client
          </DialogTitle>
          <DialogDescription>
            Relancer le cycle de vente pour {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-300">
                  Mode Retape HEJJA
                </p>
                <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                  Cette vente sera masquée des statistiques et du CRM hors mode HEJJA.
                  Les commissions seront comptabilisées dans "Commission HEJJA".
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nouvelle régie associée</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedRegieId} onValueChange={setSelectedRegieId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une régie" />
                </SelectTrigger>
                <SelectContent>
                  {regies.map((regie) => (
                    <SelectItem key={regie.id} value={regie.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: regie.couleur }}
                        />
                        <span>{regie.nom}</span>
                        {regie.is_hejja && (
                          <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/30">
                            HEJJA
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={handleRetape}
            disabled={saving || !selectedRegieId}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Créer la retape
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
