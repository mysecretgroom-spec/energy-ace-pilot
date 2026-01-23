import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Phone, FolderOpen, Calculator, MessageCircle, Wrench, RefreshCw, Euro, Loader2 } from "lucide-react";
import { NavigationButton } from "./NavigationButton";
import { RdvStatusSelector } from "./RdvStatusSelector";
import { RegieSelector } from "./RegieSelector";
import { RdvStatus } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  typeRdv: RdvType;
  currentStatus: RdvStatus;
  etudeId?: string | null;
  regieId?: string | null;
  regieNom?: string | null;
  regieCouleur?: string | null;
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
  typeRdv,
  currentStatus,
  etudeId,
  regieId,
  regieNom,
  regieCouleur,
  onRefresh,
  onStatusChange,
  onRegieChange,
  onBeforeNavigate,
}: RdvActionsProps) {
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const handleNavigate = (path: string) => {
    onBeforeNavigate?.();
    navigate(path);
  };

  const handleCall = () => {
    if (clientPhone) {
      window.open(`tel:${clientPhone}`, "_self");
    }
  };

  const handleWhatsApp = () => {
    if (clientPhone) {
      const cleanPhone = clientPhone.replace(/\D/g, "");
      const frPhone = cleanPhone.startsWith("0") ? `33${cleanPhone.slice(1)}` : cleanPhone;
      window.open(`https://wa.me/${frPhone}`, "_blank");
    }
  };

  const handleOpenClient = () => {
    handleNavigate(`/clients/${clientId}`);
  };

  const handleNewEtude = () => {
    handleNavigate(`/etude/new?clientId=${clientId}&rdvId=${rdvId}`);
  };

  const handleSwitchType = async (newType: RdvType) => {
    setSwitching(true);
    try {
      const { error } = await supabase
        .from("rdv")
        .update({ type_rdv: newType })
        .eq("id", rdvId);

      if (error) throw error;

      toast.success(
        newType === 'external_installation' 
          ? "Marqué comme installation externe" 
          : "Marqué comme RDV standard"
      );
      onRefresh();
    } catch (err) {
      console.error("Error switching type:", err);
      toast.error("Erreur lors du changement de type");
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateVente = () => {
    // Navigate to CRM with pre-filled data via URL params
    const params = new URLSearchParams({
      clientId,
      clientName,
      type: 'external_installation',
    });
    handleNavigate(`/crm?newVente=true&${params.toString()}`);
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
        onClick={handleCall}
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
        onClick={handleWhatsApp}
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
      />

      {/* Fiche client */}
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full"
        onClick={handleOpenClient}
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
          onClick={handleNewEtude}
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
            disabled={switching}
            title="Changer type RDV"
          >
            {switching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => handleSwitchType('standard')}
            disabled={typeRdv === 'standard'}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            RDV Standard
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleSwitchType('external_installation')}
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
          onClick={handleCreateVente}
          title="Créer la vente"
        >
          <Euro className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
