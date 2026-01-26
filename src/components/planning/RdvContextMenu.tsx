import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  X, 
  Wrench,
  Calendar,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RdvStatus } from "@/components/ui/status-badge";
import { RdvStatusSelector } from "./RdvStatusSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RdvContextMenuProps {
  rdv: {
    id: string;
    client: string;
    clientPrenom?: string;
    clientId: string;
    time: string;
    date: Date;
    status: RdvStatus;
    typeRdv: "standard" | "external_installation";
    etudeId?: string | null;
    regieId?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (rdvId: string, newStatus: RdvStatus) => void;
  onMoveRequest?: () => void;
  onRefresh?: () => void;
}

export function RdvContextMenu({
  rdv,
  isOpen,
  onClose,
  onStatusChange,
  onMoveRequest,
  onRefresh,
}: RdvContextMenuProps) {
  const navigate = useNavigate();
  const [canClose, setCanClose] = useState(false);

  // Prevent immediate close from touch release that opened the menu
  // 500ms delay provides good balance between accidental close prevention and responsiveness
  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      const timer = setTimeout(() => setCanClose(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleBackdropInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (canClose) {
      onClose();
    }
  };

  const handleDocuments = () => {
    navigate(`/clients/${rdv.clientId}?tab=documents`);
    onClose();
  };

  const handleNewEtude = () => {
    navigate(`/etude/new?clientId=${rdv.clientId}&rdvId=${rdv.id}`);
    onClose();
  };

  const handleExternalToggle = async () => {
    const newType = rdv.typeRdv === "external_installation" ? "standard" : "external_installation";
    
    try {
      const { error } = await supabase
        .from("rdv")
        .update({ type_rdv: newType })
        .eq("id", rdv.id);

      if (error) throw error;

      toast.success(
        newType === "external_installation" 
          ? "RDV marqué comme installation externe" 
          : "RDV remis en standard"
      );
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error("Error updating RDV type:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleMove = () => {
    onMoveRequest?.();
    onClose();
  };

  const handleStatusChange = (newStatus: RdvStatus) => {
    // Don't close the menu here - let the WhatsApp dialog show first
    // The menu will stay open to allow the WhatsApp confirmation
    onStatusChange?.(rdv.id, newStatus);
    // Note: We don't call onClose() here to keep the context menu open
    // so the WhatsAppConfirmDialog inside RdvStatusSelector can display
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={handleBackdropInteraction}
            onTouchEnd={handleBackdropInteraction}
          />

          {/* Menu Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t shadow-2xl max-h-[80vh] overflow-y-auto overscroll-contain"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{rdv.client}</h3>
                <p className="text-sm text-muted-foreground">{rdv.time}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
              {/* Status Selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Modifier le statut
                </p>
                <RdvStatusSelector
                  rdvId={rdv.id}
                  currentStatus={rdv.status}
                  clientName={rdv.client}
                  clientPrenom={rdv.clientPrenom}
                  clientId={rdv.clientId}
                  etudeId={rdv.etudeId}
                  regieId={rdv.regieId}
                  rdvDate={rdv.date}
                  onStatusChange={handleStatusChange}
                  onWhatsAppComplete={onClose}
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1"
                  onClick={handleDocuments}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs">Documents</span>
                </Button>

                {/* Nouvelle étude - only for standard RDV */}
                {rdv.typeRdv === "standard" && (
                  <Button
                    variant="outline"
                    className="h-14 flex-col gap-1"
                    onClick={handleNewEtude}
                  >
                    <Calculator className="h-5 w-5" />
                    <span className="text-xs">Nouvelle étude</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className={`h-14 flex-col gap-1 ${
                    rdv.typeRdv === "external_installation" 
                      ? "border-amber-500 bg-amber-500/10 text-amber-600" 
                      : ""
                  }`}
                  onClick={handleExternalToggle}
                >
                  <Wrench className="h-5 w-5" />
                  <span className="text-xs">
                    {rdv.typeRdv === "external_installation" ? "Retirer externe" : "RDV Externe"}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1"
                  onClick={handleMove}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">Déplacer le RDV</span>
                </Button>
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-6" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
