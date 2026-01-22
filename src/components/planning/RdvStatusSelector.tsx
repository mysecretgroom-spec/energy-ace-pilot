import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RdvStatus } from "@/components/ui/status-badge";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface RdvStatusSelectorProps {
  rdvId: string;
  currentStatus: RdvStatus;
  clientName: string;
  clientPrenom?: string;
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
  onStatusChange,
  compact = false,
}: RdvStatusSelectorProps) {
  const { user } = useAuth();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<RdvStatus>(currentStatus);

  const handleStatusChange = async (newStatus: RdvStatus) => {
    if (newStatus === status || !user) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("rdv")
        .update({ status: newStatus })
        .eq("id", rdvId);

      if (error) throw error;

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
    <Select
      value={status}
      onValueChange={(value) => handleStatusChange(value as RdvStatus)}
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
  );
}
