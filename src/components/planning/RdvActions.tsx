import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, FolderOpen, Calculator, MessageCircle, Wrench, RefreshCw, Euro, Loader2, Trash2, FileText } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RdvType = 'standard' | 'external_installation';

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

    await sendPdfDoc({
      clientId,
      phoneNumber: confirmateur.telephone,
      message: `📄 Dossier complet pour ${clientName}`,
      includeEtude: true,
    });
  };

  const handleStatusChangeInternal = (newStatus: RdvStatus) => {
    onStatusChange?.(newStatus);
    onRefresh();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Sélecteur de statut */}
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

      {/* Fiche client */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={() => openClient(clientId)}
        title="Dossier client"
      >
        <FolderOpen className="h-4 w-4" />
      </Button>

      {/* Nouvelle étude (seulement pour RDV standard) */}
      {typeRdv === 'standard' && (
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full"
          onClick={() => openNewEtude(clientId, rdvId)}
          title="Nouvelle étude"
        >
          <Calculator className="h-4 w-4" />
        </Button>
      )}

      {/* Switch type RDV */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={`h-9 w-9 rounded-full ${typeRdv === 'external_installation' ? 'bg-amber-500/20 border-amber-500' : ''}`}
            disabled={switchingType}
            title="Changer type RDV"
          >
            {switchingType ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => switchRdvType(rdvId, 'standard')}
            disabled={typeRdv === 'standard'}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            RDV Standard
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => switchRdvType(rdvId, 'external_installation')}
            disabled={typeRdv === 'external_installation'}
            className="gap-2"
          >
            <Wrench className="h-4 w-4" />
            Installation Externe
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Créer vente (seulement pour installation externe) */}
      {typeRdv === 'external_installation' && (
        <Button
          size="icon"
          variant="default"
          className="h-9 w-9 rounded-full bg-amber-500 hover:bg-amber-600"
          onClick={() => setExternalVenteDialogOpen(true)}
          title="Créer la vente"
        >
          <Euro className="h-4 w-4" />
        </Button>
      )}

      {/* Envoyer dossier au confirmateur */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full text-primary"
        onClick={handleSendDossier}
        disabled={isSendingDoc || !regieId}
        title="Envoyer dossier au confirmateur"
      >
        {isSendingDoc ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </Button>

      {/* Supprimer RDV */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10"
        onClick={() => openDeleteDialog(rdvId)}
        title="Supprimer le RDV"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      
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
