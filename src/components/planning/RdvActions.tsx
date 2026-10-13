import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, FolderOpen, Calculator, MessageCircle, Wrench, RefreshCw, Euro, Loader2, Trash2, FileText, MoreHorizontal } from "lucide-react";
import { NavigationButton } from "./NavigationButton";
import { RdvStatusSelector } from "./RdvStatusSelector";
import { RegieSelector } from "./RegieSelector";
import { ExternalVenteDialog } from "./ExternalVenteDialog";
import { RdvStatus } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { useDeleteEntity } from "@/hooks/useDeleteEntity";
import { useSendWhatsAppPdfDoc } from "@/hooks/useSendWhatsAppPdfDoc";
import { useRdvActions } from "@/hooks/useRdvActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RdvType = 'standard' | 'external_installation' | 'installation';

interface RdvActionsProps {
  rdvId: string;
  clientId: string;
  clientPhone?: string;
  clientName: string;
  address: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  typeRdv: RdvType;
  currentStatus: RdvStatus;
  etudeId?: string | null;
  regieId?: string | null;
  regieNom?: string | null;
  regieCouleur?: string | null;
  rdvDate?: string;
  onRefresh: () => void;
  onStatusChange?: (newStatus: RdvStatus) => void;
  onRegieChange?: (regieId: string | null, regieNom: string | null, regieCouleur: string | null) => void;
  onBeforeNavigate?: () => void;
}

export function RdvActions({ 
  rdvId, 
  clientId, 
  clientPhone, 
  clientName,
  address,
  city,
  postalCode,
  latitude,
  longitude,
  typeRdv,
  currentStatus,
  etudeId,
  regieId,
  regieNom,
  regieCouleur,
  rdvDate,
  onRefresh,
  onStatusChange,
  onRegieChange,
  onBeforeNavigate,
}: RdvActionsProps) {
  const [externalVenteDialogOpen, setExternalVenteDialogOpen] = useState(false);
  const { sendPdfDoc, isSending: isSendingDoc } = useSendWhatsAppPdfDoc();

  const {
    callPhone,
    openWhatsApp,
    openClient,
    openNewEtude,
    switchRdvType,
    switchingType,
  } = useRdvActions({ onRefresh, onBeforeNavigate });

  // Delete functionality
  const {
    isDeleteDialogOpen,
    isDeleting,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
  } = useDeleteEntity({
    tableName: "rdv",
    entityName: "RDV",
    onSuccess: onRefresh,
  });

  const handleSendDossier = async () => {
    if (!regieId) {
      toast.error("Aucune régie associée à ce RDV");
      return;
    }

    const { data: confirmateur, error } = await supabase
      .from("confirmateurs")
      .select("telephone, nom")
      .eq("regie_id", regieId)
      .eq("actif", true)
      .order("ordre_priorite", { ascending: true })
      .limit(1)
      .single();

    if (error || !confirmateur) {
      toast.error("Aucun confirmateur actif trouvé pour cette régie");
      return;
    }

    // Ouvre WhatsApp avec le message déjà écrit, puis propose le PDF en pièce jointe.
    const digits = (confirmateur.telephone || "").replace(/\D/g, "");
    const waPhone = digits.startsWith("0") ? `33${digits.slice(1)}` : digits;
    const message = `📄 Dossier complet pour ${clientName}`;
    const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(whatsappUrl, "_blank");
    if (!opened) window.location.href = whatsappUrl;

    await sendPdfDoc({
      clientId,
      phoneNumber: confirmateur.telephone,
      message,
      includeEtude: true,
    });
  };

  const handleStatusChangeInternal = (newStatus: RdvStatus) => {
    onStatusChange?.(newStatus);
    onRefresh();
  };

  const isInstallation = typeRdv === 'installation';

  return (
    <div className="flex flex-col gap-2">
      {/* Sélecteur de statut — masqué pour les RDV de pose (installation) */}
      {!isInstallation && (
        <RdvStatusSelector
          rdvId={rdvId}
          currentStatus={currentStatus}
          clientName={clientName}
          clientId={clientId}
          etudeId={etudeId}
          regieId={regieId}
          rdvDate={rdvDate}
          onStatusChange={handleStatusChangeInternal}
          compact
        />
      )}
      
      {/* Sélecteur de régie */}
      <RegieSelector
        rdvId={rdvId}
        currentRegieId={regieId}
        currentRegieNom={regieNom}
        currentRegieCouleur={regieCouleur}
        onRegieChange={onRegieChange}
      />
      {/* Appeler */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={() => callPhone(clientPhone)}
        disabled={!clientPhone}
        title="Appeler"
      >
        <Phone className="h-4 w-4" />
      </Button>

      {/* WhatsApp */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={() => openWhatsApp(clientPhone)}
        disabled={!clientPhone}
        title="WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      {/* Navigation GPS */}
      <NavigationButton 
        address={address} 
        city={city} 
        postalCode={postalCode}
        latitude={latitude}
        longitude={longitude}
      />

      {/* Autres actions regroupées */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" title="Plus d'actions" aria-label="Plus d'actions">
            {switchingType || isSendingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => openClient(clientId)} className="gap-2">
            <FolderOpen className="h-4 w-4" /> Dossier client
          </DropdownMenuItem>
          {typeRdv === 'standard' && (
            <DropdownMenuItem onClick={() => openNewEtude(clientId, rdvId)} className="gap-2">
              <Calculator className="h-4 w-4" /> Nouvelle étude
            </DropdownMenuItem>
          )}
          {typeRdv === 'external_installation' && (
            <DropdownMenuItem onClick={() => setExternalVenteDialogOpen(true)} className="gap-2">
              <Euro className="h-4 w-4" /> Créer la vente
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleSendDossier} disabled={isSendingDoc || !regieId} className="gap-2">
            <FileText className="h-4 w-4" /> Envoyer dossier au confirmateur
          </DropdownMenuItem>
          {!isInstallation && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchRdvType(rdvId, 'standard')} disabled={switchingType || typeRdv === 'standard'} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Passer en RDV standard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchRdvType(rdvId, 'external_installation')} disabled={switchingType || typeRdv === 'external_installation'} className="gap-2">
                <Wrench className="h-4 w-4" /> Passer en installation externe
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openDeleteDialog(rdvId)} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" /> Supprimer le RDV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* External Vente Dialog */}
      <ExternalVenteDialog
        open={externalVenteDialogOpen}
        onOpenChange={setExternalVenteDialogOpen}
        clientId={clientId}
        clientName={clientName}
        rdvId={rdvId}
        rdvDate={rdvDate}
        regieId={regieId}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={cancelDelete}
        onConfirm={confirmDelete}
        title="Supprimer ce RDV ?"
        description={`Le rendez-vous avec ${clientName} sera supprimé définitivement.`}
        isLoading={isDeleting}
      />
    </div>
  );
}
