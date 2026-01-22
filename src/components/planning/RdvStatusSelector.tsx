import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RdvStatus } from "@/components/ui/status-badge";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, CalendarIcon } from "lucide-react";

interface RdvStatusSelectorProps {
  rdvId: string;
  currentStatus: RdvStatus;
  clientName: string;
  clientPrenom?: string;
  clientId?: string;
  etudeId?: string | null;
  onStatusChange?: (newStatus: RdvStatus) => void;
  compact?: boolean;
}

const statusOptions: { value: RdvStatus; label: string; color: string }[] = [
  { value: "nouveau", label: "Nouveau", color: "bg-blue-500" },
  { value: "reporte", label: "Reporté", color: "bg-orange-500" },
  { value: "r2", label: "R2", color: "bg-purple-500" },
  { value: "r2_prestudy", label: "R2 Pré-étude", color: "bg-indigo-500" },
  { value: "signe", label: "Signé", color: "bg-green-500" },
  { value: "negatif", label: "Négatif", color: "bg-red-500" },
  { value: "annule", label: "Annulé", color: "bg-gray-500" },
];

// Map RDV status to WhatsApp classification
const statusToClassification: Record<RdvStatus, string> = {
  nouveau: "attente",
  reporte: "attente",
  r2: "r2",
  r2_prestudy: "r2_prestudy",
  signe: "positif",
  negatif: "negatif",
  annule: "annule",
};

export function RdvStatusSelector({
  rdvId,
  currentStatus,
  clientName,
  clientPrenom,
  clientId,
  etudeId,
  onStatusChange,
  compact = false,
}: RdvStatusSelectorProps) {
  const { user } = useAuth();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<RdvStatus>(currentStatus);
  
  // R2 date/time picker state
  const [showR2Dialog, setShowR2Dialog] = useState(false);
  const [pendingR2Status, setPendingR2Status] = useState<RdvStatus | null>(null);
  const [r2Date, setR2Date] = useState<Date | undefined>(undefined);
  const [r2Time, setR2Time] = useState("10:00");

  // Signé dialog state
  const [showSigneDialog, setShowSigneDialog] = useState(false);
  const [signePuissance, setSignePuissance] = useState("");
  const [signePrixTTC, setSignePrixTTC] = useState("");
  const [signePrixHT, setSignePrixHT] = useState("");

  const handleStatusSelect = async (newStatus: RdvStatus) => {
    if (newStatus === status || !user) return;
    
    // If R2 or R2 Pré-étude, show date picker dialog
    if (newStatus === "r2" || newStatus === "r2_prestudy") {
      setPendingR2Status(newStatus);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setR2Date(tomorrow);
      setR2Time("10:00");
      setShowR2Dialog(true);
    } else if (newStatus === "signe") {
      // Show signé dialog for power and price - prefill from étude if available
      if (etudeId) {
        const { data: etude } = await supabase
          .from("etudes")
          .select("puissance_kwc, prix_total")
          .eq("id", etudeId)
          .maybeSingle();
        
        if (etude) {
          const puissance = etude.puissance_kwc?.toString() || "";
          const prixTTC = etude.prix_total?.toString() || "";
          setSignePuissance(puissance);
          setSignePrixTTC(prixTTC);
          // Calculate HT
          if (prixTTC && puissance) {
            const ttc = parseFloat(prixTTC);
            const puissanceNum = parseFloat(puissance);
            if (!isNaN(ttc) && ttc > 0) {
              const tauxTVA = !isNaN(puissanceNum) && puissanceNum <= 3 ? 0.10 : 0.20;
              setSignePrixHT((ttc / (1 + tauxTVA)).toFixed(2));
            }
          }
        } else {
          setSignePuissance("");
          setSignePrixTTC("");
          setSignePrixHT("");
        }
      } else {
        setSignePuissance("");
        setSignePrixTTC("");
        setSignePrixHT("");
      }
      setShowSigneDialog(true);
    } else {
      // Direct status change for other statuses
      handleStatusChange(newStatus);
    }
  };

  const handleR2Confirm = async () => {
    if (!pendingR2Status || !r2Date || !user) return;
    
    const [hours, minutes] = r2Time.split(":").map(Number);
    const r2DateTime = new Date(r2Date);
    r2DateTime.setHours(hours, minutes, 0, 0);
    
    setShowR2Dialog(false);
    await handleStatusChange(pendingR2Status, { r2DateTime: r2DateTime.toISOString() });
    setPendingR2Status(null);
  };

  const handleSigneConfirm = async () => {
    if (!user || !clientId) return;
    
    const puissance = parseFloat(signePuissance);
    const prixTTC = parseFloat(signePrixTTC);
    
    if (isNaN(puissance) || puissance <= 0) {
      toast.error("Veuillez saisir une puissance valide");
      return;
    }
    if (isNaN(prixTTC) || prixTTC <= 0) {
      toast.error("Veuillez saisir un prix TTC valide");
      return;
    }

    setShowSigneDialog(false);
    await handleStatusChange("signe", { puissanceKwc: puissance, prixTTC });
  };

  // Calculate HT from TTC based on power
  const handlePrixTTCChange = (value: string) => {
    setSignePrixTTC(value);
    const ttc = parseFloat(value);
    const puissance = parseFloat(signePuissance);
    
    if (!isNaN(ttc) && ttc > 0) {
      // Use 10% TVA if power <= 3kWc, else 20%
      const tauxTVA = !isNaN(puissance) && puissance <= 3 ? 0.10 : 0.20;
      const ht = ttc / (1 + tauxTVA);
      setSignePrixHT(ht.toFixed(2));
    } else {
      setSignePrixHT("");
    }
  };

  // Recalculate HT when power changes
  const handlePuissanceChange = (value: string) => {
    setSignePuissance(value);
    // Recalculate HT if TTC is set
    if (signePrixTTC) {
      const ttc = parseFloat(signePrixTTC);
      const puissance = parseFloat(value);
      if (!isNaN(ttc) && ttc > 0) {
        const tauxTVA = !isNaN(puissance) && puissance <= 3 ? 0.10 : 0.20;
        const ht = ttc / (1 + tauxTVA);
        setSignePrixHT(ht.toFixed(2));
      }
    }
  };

  interface StatusChangeOptions {
    r2DateTime?: string;
    puissanceKwc?: number;
    prixTTC?: number;
  }

  const handleStatusChange = async (newStatus: RdvStatus, options?: StatusChangeOptions) => {
    if (!user) return;
    
    setUpdating(true);
    try {
      // Update RDV status
      const updateData: Record<string, unknown> = { 
        status: newStatus,
        is_r2: newStatus === "r2" || newStatus === "r2_prestudy",
        r2_type: newStatus === "r2_prestudy" ? "r2_prestudy" : (newStatus === "r2" ? "r2" : null),
      };
      
      const { error } = await supabase
        .from("rdv")
        .update(updateData)
        .eq("id", rdvId);

      if (error) throw error;

      // If R2, create new R2 appointment
      if ((newStatus === "r2" || newStatus === "r2_prestudy") && options?.r2DateTime && clientId) {
        const { data: originalRdv } = await supabase
          .from("rdv")
          .select("adresse, type_projet, duree_minutes")
          .eq("id", rdvId)
          .maybeSingle();

        if (originalRdv) {
          const { error: r2Error } = await supabase
            .from("rdv")
            .insert({
              user_id: user.id,
              client_id: clientId,
              date_heure: options.r2DateTime,
              adresse: originalRdv.adresse,
              type_projet: originalRdv.type_projet,
              duree_minutes: originalRdv.duree_minutes || 90,
              status: "nouveau",
              type_rdv: "standard",
              is_r2: true,
              r2_type: newStatus === "r2_prestudy" ? "r2_prestudy" : "r2",
            });

          if (r2Error) {
            console.error("Error creating R2 RDV:", r2Error);
            toast.error("Erreur lors de la création du RDV R2");
          } else {
            toast.success("RDV R2 créé avec succès");
          }
        }
      }

      // If Signé, create vente record
      if (newStatus === "signe" && options?.puissanceKwc && options?.prixTTC && clientId) {
        const tauxTVA = options.puissanceKwc <= 3 ? 0.10 : 0.20;
        const prixHT = options.prixTTC / (1 + tauxTVA);
        
        const { error: venteError } = await supabase
          .from("ventes")
          .insert({
            user_id: user.id,
            client_id: clientId,
            etude_id: etudeId || null,
            puissance_kwc: options.puissanceKwc,
            montant_ttc: options.prixTTC,
            montant_ht: prixHT,
            date_signature: new Date().toISOString().split("T")[0],
            status: "cq_a_faire",
            type_vente: "standard",
            type_installation: "photovoltaique",
          });

        if (venteError) {
          console.error("Error creating vente:", venteError);
          toast.error("Erreur lors de la création de la vente");
        } else {
          toast.success("Vente créée avec succès");
        }
      }

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      
      const statusLabel = statusOptions.find(s => s.value === newStatus)?.label;
      toast.success(`Statut changé en "${statusLabel}"`);

      // Send WhatsApp notification to confirmateur
      const classification = statusToClassification[newStatus];
      if (classification) {
        await sendWhatsAppNotification({
          clientName,
          clientPrenom,
          classification,
          userId: user.id,
          r2DateTime: options?.r2DateTime || null,
        });
      }
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Erreur lors du changement de statut");
    } finally {
      setUpdating(false);
    }
  };

  const currentOption = statusOptions.find(s => s.value === status);

  return (
    <>
      <Select
        value={status}
        onValueChange={(value) => handleStatusSelect(value as RdvStatus)}
        disabled={updating}
      >
        <SelectTrigger 
          className={`${compact ? 'h-8 text-xs w-[120px]' : 'h-9 w-[140px]'} ${updating ? 'opacity-50' : ''}`}
        >
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${currentOption?.color}`} />
              <SelectValue />
            </div>
          )}
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${option.color}`} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* R2 Date/Time Dialog */}
      <Dialog open={showR2Dialog} onOpenChange={setShowR2Dialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Planifier le RDV {pendingR2Status === "r2_prestudy" ? "R2 Pré-étude" : "R2"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date du RDV R2</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !r2Date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {r2Date ? format(r2Date, "PPP", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={r2Date}
                    onSelect={setR2Date}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="r2-time">Heure du RDV</Label>
              <Input
                id="r2-time"
                type="time"
                value={r2Time}
                onChange={(e) => setR2Time(e.target.value)}
                className="w-full"
              />
            </div>

            {r2Date && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  RDV prévu le{" "}
                  <span className="font-medium text-foreground">
                    {format(r2Date, "EEEE d MMMM yyyy", { locale: fr })}
                  </span>{" "}
                  à{" "}
                  <span className="font-medium text-foreground">{r2Time}</span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowR2Dialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleR2Confirm} disabled={!r2Date || updating}>
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signé Dialog - Puissance et Prix */}
      <Dialog open={showSigneDialog} onOpenChange={setShowSigneDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>✅ Vente signée</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Renseignez les informations de la vente pour calculer les commissions.
            </p>

            <div className="space-y-2">
              <Label htmlFor="puissance">Puissance (kWc)</Label>
              <Input
                id="puissance"
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 3.0"
                value={signePuissance}
                onChange={(e) => handlePuissanceChange(e.target.value)}
                className="w-full"
              />
              {parseFloat(signePuissance) > 0 && (
                <p className="text-xs text-muted-foreground">
                  TVA applicable : {parseFloat(signePuissance) <= 3 ? "10%" : "20%"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prixTTC">Prix de vente TTC (€)</Label>
              <Input
                id="prixTTC"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 12000"
                value={signePrixTTC}
                onChange={(e) => handlePrixTTCChange(e.target.value)}
                className="w-full"
              />
            </div>

            {signePrixHT && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Montant HT :</span>{" "}
                  <span className="font-semibold text-foreground">
                    {parseFloat(signePrixHT).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Les commissions seront calculées sur ce montant HT.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSigneDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSigneConfirm} 
              disabled={!signePuissance || !signePrixTTC || updating}
              className="bg-green-600 hover:bg-green-700"
            >
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Créer la vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
