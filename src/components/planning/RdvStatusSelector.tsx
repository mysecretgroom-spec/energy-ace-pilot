import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RdvStatus } from "@/components/ui/status-badge";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { WhatsAppConfirmDialog } from "@/components/notifications/WhatsAppConfirmDialog";

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
import { SigneDialog } from "./SigneDialog";

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

  // WhatsApp confirm dialog state
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{
    classification: string;
    r2DateTime?: string | null;
  } | null>(null);
  const [skipWhatsAppPrompt, setSkipWhatsAppPrompt] = useState(false);

  // Load user's WhatsApp prompt preference
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("settings_notifications")
        .select("skip_whatsapp_prompt, whatsapp_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        // Skip prompt if user disabled it OR if WhatsApp is disabled entirely
        setSkipWhatsAppPrompt(data.skip_whatsapp_prompt || !data.whatsapp_enabled);
      }
    };
    
    loadSettings();
  }, [user]);
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
      // Show signé dialog - it handles étude prefilling internally
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

  const handleSigneConfirm = async (data: { puissanceKwc: number; prixTTC: number; bouquetId?: string }) => {
    if (!user || !clientId) return;
    
    setShowSigneDialog(false);
    await handleStatusChange("signe", { puissanceKwc: data.puissanceKwc, prixTTC: data.prixTTC });
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

      // Show WhatsApp confirmation dialog (unless user disabled it)
      const classification = statusToClassification[newStatus];
      if (classification && !skipWhatsAppPrompt) {
        setPendingWhatsApp({
          classification,
          r2DateTime: options?.r2DateTime || null,
        });
        setShowWhatsAppDialog(true);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Erreur lors du changement de statut");
    } finally {
      setUpdating(false);
    }
  };

  const handleWhatsAppConfirm = async () => {
    if (!pendingWhatsApp || !user) return;
    
    await sendWhatsAppNotification({
      clientName,
      clientPrenom,
      classification: pendingWhatsApp.classification,
      userId: user.id,
      r2DateTime: pendingWhatsApp.r2DateTime,
    });
    
    setPendingWhatsApp(null);
  };

  const handleWhatsAppCancel = () => {
    setPendingWhatsApp(null);
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

      {/* Signé Dialog */}
      <SigneDialog
        open={showSigneDialog}
        onOpenChange={setShowSigneDialog}
        etudeId={etudeId}
        onConfirm={handleSigneConfirm}
        updating={updating}
      />

      {/* WhatsApp Confirm Dialog */}
      <WhatsAppConfirmDialog
        open={showWhatsAppDialog}
        onOpenChange={setShowWhatsAppDialog}
        onConfirm={handleWhatsAppConfirm}
        onCancel={handleWhatsAppCancel}
        clientName={[clientPrenom, clientName].filter(Boolean).join(" ")}
        classification={pendingWhatsApp?.classification || "attente"}
      />
    </>
  );
}
