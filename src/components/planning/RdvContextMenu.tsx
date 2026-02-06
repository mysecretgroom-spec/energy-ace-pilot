import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  X, 
  Wrench,
  Calendar,
  Calculator,
  Phone,
  MessageCircle,
  Navigation,
  Map,
  MapPin,
  FolderOpen,
  Euro,
  Trash2,
  Loader2,
  Car,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RdvStatus, StatusBadge } from "@/components/ui/status-badge";
import { RdvStatusSelector } from "./RdvStatusSelector";
import { RegieSelector } from "./RegieSelector";
import { ExternalVenteDialog } from "./ExternalVenteDialog";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { useDeleteEntity } from "@/hooks/useDeleteEntity";
import { useRdvActions } from "@/hooks/useRdvActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    regieNom?: string | null;
    regieCouleur?: string | null;
    phone?: string | null;
    address?: string;
    city?: string;
    postalCode?: string;
    distance?: string;
    travelTime?: string;
    alert?: boolean;
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
  const [canClose, setCanClose] = useState(false);
  const [externalVenteDialogOpen, setExternalVenteDialogOpen] = useState(false);
  const [regieId, setRegieId] = useState(rdv.regieId);
  const [regieNom, setRegieNom] = useState(rdv.regieNom);
  const [regieCouleur, setRegieCouleur] = useState(rdv.regieCouleur);

  const {
    callPhone,
    openWhatsApp,
    openClient,
    openClientDocuments,
    openNewEtude,
    openWaze,
    openGoogleMaps,
    openAppleMaps,
    toggleExternalType,
    switchingType,
  } = useRdvActions({ onRefresh });

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
    onSuccess: () => {
      onRefresh?.();
      onClose();
    },
  });

  // Prevent immediate close from touch release that opened the menu
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
    openClientDocuments(rdv.clientId);
    onClose();
  };

  const handleOpenClient = () => {
    openClient(rdv.clientId);
    onClose();
  };

  const handleNewEtude = () => {
    openNewEtude(rdv.clientId, rdv.id);
    onClose();
  };

  const handleMove = () => {
    onMoveRequest?.();
    onClose();
  };

  const handleStatusChange = (newStatus: RdvStatus) => {
    onStatusChange?.(rdv.id, newStatus);
  };

  const handleRegieChange = (newRegieId: string | null, newRegieNom: string | null, newRegieCouleur: string | null) => {
    setRegieId(newRegieId);
    setRegieNom(newRegieNom);
    setRegieCouleur(newRegieCouleur);
    onRefresh?.();
  };

  const isExternalInstallation = rdv.typeRdv === "external_installation";

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
            className="fixed inset-0 bg-black/60 z-[100]"
            onClick={handleBackdropInteraction}
            onTouchEnd={handleBackdropInteraction}
          />

          {/* Menu Sheet - responsive for tablet/desktop */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed z-[101] bg-background rounded-t-2xl sm:rounded-2xl border-t sm:border shadow-2xl overflow-y-auto overscroll-contain safe-bottom
              inset-x-0 bottom-0 max-h-[85vh]
              sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full sm:max-h-[80vh]"
          >
            {/* Handle - only on mobile */}
            <div className="flex justify-center pt-3 pb-2 sm:hidden">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header with client info */}
            <div className="px-4 pb-3 pt-2 sm:pt-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {regieNom && (
                      <Badge 
                        className="text-xs px-2 py-0.5 flex items-center gap-1 rounded-full"
                        style={{ 
                          backgroundColor: regieCouleur ? `${regieCouleur}20` : undefined,
                          color: regieCouleur || undefined,
                          borderColor: regieCouleur ? `${regieCouleur}50` : undefined,
                          borderWidth: '1px',
                        }}
                      >
                        <Building2 className="h-3 w-3" />
                        {regieNom}
                      </Badge>
                    )}
                    {isExternalInstallation && (
                      <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5 flex items-center gap-1 rounded-full">
                        <Wrench className="h-3 w-3" />
                        Externe
                      </Badge>
                    )}
                    <StatusBadge status={rdv.status} />
                  </div>
                  <h3 className="font-bold text-lg text-foreground truncate">{rdv.client}</h3>
                  <p className="text-sm text-muted-foreground">{rdv.time}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-10 w-10 min-h-[44px] min-w-[44px] flex-shrink-0 touch-target-lg"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Address */}
              {rdv.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2.5 mt-3">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary/70" />
                  <span className="leading-relaxed">
                    {[rdv.address, rdv.postalCode, rdv.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {/* Distance/Travel time info */}
              {rdv.travelTime && rdv.distance && (
                <div className={`flex items-center justify-center gap-4 py-2.5 mt-3 rounded-xl border border-dashed transition-all ${
                  rdv.alert 
                    ? "border-secondary bg-secondary/10" 
                    : "border-muted-foreground/20 bg-muted/20"
                }`}>
                  <Car className={`h-4 w-4 ${rdv.alert ? "text-secondary" : "text-muted-foreground"}`} />
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${rdv.alert ? "text-secondary" : "text-foreground"}`}>
                      {rdv.travelTime}
                    </span>
                    <span className="text-muted-foreground/50">•</span>
                    <span className={`text-sm font-medium ${rdv.alert ? "text-secondary" : "text-muted-foreground"}`}>
                      {rdv.distance}
                    </span>
                  </div>
                  {rdv.alert && <span className="text-secondary text-sm animate-pulse">⚠️</span>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 space-y-4">
              {/* Quick actions row - Call, WhatsApp, GPS, Dossier */}
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1 touch-target-lg"
                  onClick={() => callPhone(rdv.phone)}
                  disabled={!rdv.phone}
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-xs">Appeler</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1 touch-target-lg"
                  onClick={() => openWhatsApp(rdv.phone)}
                  disabled={!rdv.phone}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs">WhatsApp</span>
                </Button>

                {/* GPS Navigation Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="default"
                      className="h-14 flex-col gap-1 touch-target-lg bg-gradient-hero"
                      disabled={!rdv.address}
                    >
                      <Navigation className="h-5 w-5" />
                      <span className="text-xs">GPS</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-48 z-[200]">
                    <DropdownMenuItem onClick={() => openWaze(rdv.address, rdv.postalCode, rdv.city)} className="gap-2 cursor-pointer">
                      <Navigation className="h-4 w-4 text-[#33ccff]" />
                      Waze
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openGoogleMaps(rdv.address, rdv.postalCode, rdv.city)} className="gap-2 cursor-pointer">
                      <Map className="h-4 w-4 text-[#4285f4]" />
                      Google Maps
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openAppleMaps(rdv.address, rdv.postalCode, rdv.city)} className="gap-2 cursor-pointer">
                      <MapPin className="h-4 w-4 text-[#007aff]" />
                      Plans (Apple)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1 touch-target-lg"
                  onClick={handleOpenClient}
                >
                  <FolderOpen className="h-5 w-5" />
                  <span className="text-xs">Dossier</span>
                </Button>
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Modifier le statut
                </p>
                <div className="[&_[data-radix-popper-content-wrapper]]:!z-[200] [&_.fixed]:!z-[200]">
                  <RdvStatusSelector
                    rdvId={rdv.id}
                    currentStatus={rdv.status}
                    clientName={rdv.client}
                    clientPrenom={rdv.clientPrenom}
                    clientId={rdv.clientId}
                    etudeId={rdv.etudeId}
                    regieId={regieId}
                    rdvDate={rdv.date}
                    onStatusChange={handleStatusChange}
                    onWhatsAppComplete={onClose}
                  />
                </div>
              </div>

              {/* Régie Selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Régie
                </p>
                <div className="[&_[data-radix-popper-content-wrapper]]:!z-[200]">
                  <RegieSelector
                    rdvId={rdv.id}
                    currentRegieId={regieId}
                    currentRegieNom={regieNom}
                    currentRegieCouleur={regieCouleur}
                    onRegieChange={handleRegieChange}
                  />
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  className="h-12 flex-row gap-2 touch-target-lg"
                  onClick={handleDocuments}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Documents</span>
                </Button>

                {rdv.typeRdv === "standard" && (
                  <Button
                    variant="outline"
                    className="h-12 flex-row gap-2 touch-target-lg"
                    onClick={handleNewEtude}
                  >
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm">Nouvelle étude</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className={`h-12 flex-row gap-2 touch-target-lg ${
                    isExternalInstallation 
                      ? "border-amber-500 bg-amber-500/10 text-amber-600" 
                      : ""
                  }`}
                  onClick={() => toggleExternalType(rdv.id, rdv.typeRdv)}
                  disabled={switchingType}
                >
                  {switchingType ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4" />
                  )}
                  <span className="text-sm">
                    {isExternalInstallation ? "Retirer externe" : "RDV Externe"}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-12 flex-row gap-2 touch-target-lg"
                  onClick={handleMove}
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Déplacer</span>
                </Button>

                {isExternalInstallation && (
                  <Button
                    variant="default"
                    className="h-12 flex-row gap-2 touch-target-lg bg-amber-500 hover:bg-amber-600"
                    onClick={() => setExternalVenteDialogOpen(true)}
                  >
                    <Euro className="h-4 w-4" />
                    <span className="text-sm">Créer la vente</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="h-12 flex-row gap-2 touch-target-lg text-destructive hover:bg-destructive/10"
                  onClick={() => openDeleteDialog(rdv.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-sm">Supprimer</span>
                </Button>
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-6" />
          </motion.div>

          {/* External Vente Dialog - higher z-index */}
          <div className="[&_.fixed]:!z-[200]">
            <ExternalVenteDialog
              open={externalVenteDialogOpen}
              onOpenChange={setExternalVenteDialogOpen}
              clientId={rdv.clientId}
              clientName={rdv.client}
              rdvId={rdv.id}
              rdvDate={rdv.date.toISOString().split("T")[0]}
              regieId={regieId}
              onSuccess={() => {
                onRefresh?.();
                onClose();
              }}
            />
          </div>

          {/* Delete Confirmation Dialog - higher z-index */}
          <div className="[&_.fixed]:!z-[200]">
            <DeleteConfirmDialog
              open={isDeleteDialogOpen}
              onOpenChange={cancelDelete}
              onConfirm={confirmDelete}
              title="Supprimer ce RDV ?"
              description={`Le rendez-vous avec ${rdv.client} sera supprimé définitivement.`}
              isLoading={isDeleting}
            />
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
