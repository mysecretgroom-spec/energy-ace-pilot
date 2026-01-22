import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  X, 
  Check, 
  FileText, 
  Loader2,
  CheckCircle2,
} from "lucide-react";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule';

interface VenteSelectionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onRefresh: () => void;
  onGenerateInvoice: () => void;
}

const statusOptions: { value: VenteStatus; label: string }[] = [
  { value: "en_negociation", label: "En négociation" },
  { value: "signe", label: "Signé" },
  { value: "cq_a_faire", label: "CQ à faire" },
  { value: "cq_fait", label: "CQ fait" },
  { value: "attente_financement", label: "Att. financement" },
  { value: "envoi_pose", label: "Envoi en pose" },
  { value: "installe", label: "Posé" },
  { value: "attente_paiement", label: "Att. paiement" },
  { value: "paye", label: "Payé" },
  { value: "annule", label: "Annulé" },
];

export const VenteSelectionBar = ({ 
  selectedIds, 
  onClear, 
  onRefresh, 
  onGenerateInvoice 
}: VenteSelectionBarProps) => {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<VenteStatus | "">("");

  const handleBulkStatusUpdate = async () => {
    if (!newStatus || selectedIds.length === 0) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("ventes")
        .update({ status: newStatus })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} vente(s) mise(s) à jour`);
      setNewStatus("");
      onClear();
      onRefresh();
    } catch (error) {
      console.error("Erreur mise à jour groupée:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3 animate-slide-up">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary">
            {selectedIds.length} sélectionnée(s)
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {/* Status change */}
        <div className="flex items-center gap-2">
          <Select value={newStatus} onValueChange={(v) => setNewStatus(v as VenteStatus)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Changer le statut..." />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            size="sm" 
            onClick={handleBulkStatusUpdate}
            disabled={!newStatus || updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Generate invoice button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onGenerateInvoice}
        >
          <FileText className="h-4 w-4 mr-2" />
          Générer facture Qonto
        </Button>
      </div>
    </div>
  );
};
