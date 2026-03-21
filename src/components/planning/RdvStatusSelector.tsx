import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RdvStatus } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ProductType, PacSubtype } from "@/lib/productTypes";
import { hapticSuccess } from "@/lib/haptics";

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
import { QuickR2Dialog } from "./QuickR2Dialog";

interface RdvStatusSelectorProps {
  rdvId: string;
  currentStatus: RdvStatus;
  clientName: string;
  clientPrenom?: string;
  clientId?: string;
  etudeId?: string | null;
  regieId?: string | null;
  rdvDate?: Date | string | null; // Date du RDV pour filtrer les statuts
  onStatusChange?: (newStatus: RdvStatus) => void;
  onWhatsAppComplete?: () => void;
  compact?: boolean;
}

const allStatusOptions: { value: RdvStatus; label: string; color: string; requiresPastDate: boolean }[] = [
  { value: "nouveau", label: "Nouveau", color: "bg-blue-500", requiresPastDate: false },
  { value: "reporte", label: "Reporté", color: "bg-orange-500", requiresPastDate: false },
  { value: "annule", label: "Annulé", color: "bg-gray-500", requiresPastDate: false },
  // Statuts disponibles uniquement après que le RDV ait eu lieu
  { value: "r2", label: "R2", color: "bg-purple-500", requiresPastDate: true },
  { value: "r2_prestudy", label: "R2 Pré-étude", color: "bg-indigo-500", requiresPastDate: true },
  { value: "signe", label: "Signé", color: "bg-green-500", requiresPastDate: true },
  { value: "negatif", label: "Négatif", color: "bg-red-500", requiresPastDate: true },
  { value: "porte", label: "Porte", color: "bg-amber-700", requiresPastDate: true },
];

// Map RDV status to WhatsApp classification (1:1 mapping for clarity)
const statusToClassification: Record<RdvStatus, string> = {
  nouveau: "nouveau",
  reporte: "reporte",
  r2: "r2",
  r2_prestudy: "r2_prestudy",
  signe: "positif",
  negatif: "negatif",
  annule: "annule",
  porte: "annule",
};

export function RdvStatusSelector({
  rdvId,
  currentStatus,
  clientName,
  clientPrenom,
  clientId,
  etudeId,
  regieId,
  rdvDate,
  onStatusChange,
  onWhatsAppComplete,
  compact = false,
}: RdvStatusSelectorProps) {
  // Déterminer si le RDV est passé (l'étude a eu lieu)
  const isRdvPast = useMemo(() => {
    if (!rdvDate) return true; // Si pas de date, on autorise tout
    const rdvDateTime = typeof rdvDate === 'string' ? new Date(rdvDate) : rdvDate;
    return rdvDateTime <= new Date();
  }, [rdvDate]);

  // Filtrer les statuts disponibles selon si le RDV est passé ou non
  const statusOptions = useMemo(() => {
    return allStatusOptions.filter(option => {
      // Toujours inclure le statut actuel
      if (option.value === currentStatus) return true;
      // Avant le RDV: seulement les statuts qui ne nécessitent pas que le RDV soit passé
      if (!isRdvPast && option.requiresPastDate) return false;
      return true;
    });
  }, [isRdvPast, currentStatus]);
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<RdvStatus>(currentStatus);
  
  // R2 date/time picker state
  const [showR2Dialog, setShowR2Dialog] = useState(false);
  const [pendingR2Status, setPendingR2Status] = useState<RdvStatus | null>(null);
  const [r2Date, setR2Date] = useState<Date | undefined>(undefined);
  const [r2Time, setR2Time] = useState("10:00");

  // Signé dialog state
  const [showSigneDialog, setShowSigneDialog] = useState(false);
  const handleStatusSelect = async (newStatus: RdvStatus) => {
    if (newStatus === status || !user) return;
    
    // If R2, R2 Pré-étude, or Reporté, show optional date picker dialog
    if (newStatus === "r2" || newStatus === "r2_prestudy" || newStatus === "reporte") {
      setPendingR2Status(newStatus);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setR2Date(undefined);
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
    if (!pendingR2Status || !user) return;
    
    let r2DateTimeISO: string | undefined;
    if (r2Date) {
      const [hours, minutes] = r2Time.split(":").map(Number);
      const r2DateTime = new Date(r2Date);
      r2DateTime.setHours(hours, minutes, 0, 0);
      r2DateTimeISO = r2DateTime.toISOString();
    }
    
    setShowR2Dialog(false);
    await handleStatusChange(pendingR2Status, { r2DateTime: r2DateTimeISO });
    setPendingR2Status(null);
  };

  const handleSigneConfirm = async (data: { 
    puissanceKwc: number; 
    prixTTC: number; 
    bouquetId?: string;
    cqTime?: string;
    surcoutsIds?: string[];
    productType: ProductType;
    pacSubtype?: PacSubtype;
    surfaceM2?: number;
  }) => {
    if (!user || !clientId) return;
    
    setShowSigneDialog(false);
    await handleStatusChange("signe", { 
      puissanceKwc: data.puissanceKwc, 
      prixTTC: data.prixTTC,
      cqTime: data.cqTime,
      surcoutsIds: data.surcoutsIds,
      productType: data.productType,
      pacSubtype: data.pacSubtype,
      surfaceM2: data.surfaceM2,
    });
  };

  interface StatusChangeOptions {
    r2DateTime?: string;
    puissanceKwc?: number;
    prixTTC?: number;
    cqTime?: string;
    surcoutsIds?: string[];
    productType?: ProductType;
    pacSubtype?: PacSubtype;
    surfaceM2?: number;
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

      // If annulé or porte, cascade: also annul the parent RDV (R2/reporté chain)
      if (newStatus === "annule" || newStatus === "porte") {
        // Check if this RDV has a parent (is a child R2/reporté)
        const { data: currentRdv } = await supabase
          .from("rdv")
          .select("parent_rdv_id, client_id")
          .eq("id", rdvId)
          .maybeSingle();

        if (currentRdv?.parent_rdv_id) {
          await (supabase
            .from("rdv")
            .update({ status: "annule" } as any)
            .eq("id", currentRdv.parent_rdv_id) as any);
          console.log(`Cascade annulé: parent RDV ${currentRdv.parent_rdv_id}`);
        }

        // Also check if this RDV is a parent with children → annul children too
        const { data: childRdvs } = await (supabase
          .from("rdv")
          .select("id")
          .eq("parent_rdv_id", rdvId)
          .neq("status", "annule") as any);

        if (childRdvs && childRdvs.length > 0) {
          for (const child of childRdvs) {
            await supabase
              .from("rdv")
              .update({ status: "annule" })
              .eq("id", child.id);
          }
          console.log(`Cascade annulé: ${childRdvs.length} child RDV(s)`);
        }

        // Update etude classification to annulé
        if (clientId) {
          await supabase
            .from("etudes")
            .update({ classification: "annule" })
            .eq("client_id", clientId)
            .is("classification", null);
        }
      }

      if ((newStatus === "r2" || newStatus === "r2_prestudy" || newStatus === "reporte") && options?.r2DateTime && clientId) {
        const { data: originalRdv } = await supabase
          .from("rdv")
          .select("adresse, type_projet, duree_minutes, regie_id")
          .eq("id", rdvId)
          .maybeSingle();

        if (originalRdv) {
          const isR2 = newStatus === "r2" || newStatus === "r2_prestudy";
          const { error: newRdvError } = await supabase
            .from("rdv")
            .insert({
              user_id: user.id,
              client_id: clientId,
              date_heure: options.r2DateTime,
              adresse: originalRdv.adresse,
              type_projet: originalRdv.type_projet,
              duree_minutes: originalRdv.duree_minutes || 90,
              status: "nouveau" as const,
              type_rdv: "standard" as const,
              is_r2: isR2,
              r2_type: newStatus === "r2_prestudy" ? "r2_prestudy" : (newStatus === "r2" ? "r2" : null),
              regie_id: originalRdv.regie_id,
              parent_rdv_id: rdvId,
              needs_reconfirmation: true,
            } as any);

          if (newRdvError) {
            console.error("Error creating new RDV:", newRdvError);
            toast.error("Erreur lors de la création du nouveau RDV");
          } else {
            // Silent success
          }

          if (newRdvError) {
            console.error("Error creating new RDV:", newRdvError);
            toast.error("Erreur lors de la création du nouveau RDV");
          } else {
            // Silent success
          }
        }
      }

      // If Signé, create vente record
      if (newStatus === "signe" && options?.prixTTC && clientId) {
        const productType = options.productType || "PV";
        const tauxTVA = productType === "PV" && options.puissanceKwc && options.puissanceKwc <= 3 ? 0.10 : 0.20;
        const prixHT = options.prixTTC / (1 + tauxTVA);
        
        // Map product type to type_installation
        const typeInstallation = productType === "PV" 
          ? "photovoltaique" 
          : productType === "PAC" 
            ? "pompe_a_chaleur" 
            : "isolation_thermique";
        
        const { error: venteError } = await supabase
          .from("ventes")
          .insert({
            user_id: user.id,
            client_id: clientId,
            etude_id: etudeId || null,
            puissance_kwc: productType !== "ITE" ? options.puissanceKwc : null,
            montant_ttc: options.prixTTC,
            montant_ht: prixHT,
            date_signature: new Date().toISOString().split("T")[0],
            status: "cq_a_faire",
            type_vente: "standard",
            type_installation: typeInstallation,
            product_type: productType,
          });

        if (venteError) {
          console.error("Error creating vente:", venteError);
          toast.error("Erreur lors de la création de la vente");
        } else {
          // Silent success - status badge update is visible
        }
      }

      setStatus(newStatus);
      
      hapticSuccess();
      // Silent success - visual status change is enough feedback

      // Notify parent immediately
      onStatusChange?.(newStatus);
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
        <SelectContent className="z-[250]" position="popper" side="top" sideOffset={4}>
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

      {/* R2 Date/Time Dialog - higher z-index for context menu overlay */}
      <Dialog open={showR2Dialog} onOpenChange={setShowR2Dialog}>
        <DialogContent className="sm:max-w-[400px] z-[200]">
          <DialogHeader>
            <DialogTitle>
              {pendingR2Status === "reporte" 
                ? "Reporter le RDV" 
                : `Planifier le RDV ${pendingR2Status === "r2_prestudy" ? "R2 Pré-étude" : "R2"}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date du nouveau RDV</Label>
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
                <PopoverContent className="w-auto p-0 z-[250]" align="start">
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
            <Button onClick={handleR2Confirm} disabled={updating}>
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {r2Date ? "Confirmer" : "Confirmer sans date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signé Dialog */}
      <SigneDialog
        open={showSigneDialog}
        onOpenChange={setShowSigneDialog}
        etudeId={etudeId}
        regieId={regieId}
        onConfirm={handleSigneConfirm}
        updating={updating}
      />
    </>
  );
}
