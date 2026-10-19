import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Phone,
  MessageCircle,
  Navigation,
  Map,
  MapPin,
  FolderOpen,
  Euro,
  Trash2,
  Loader2,
  Building2,
  HardHat,
  ExternalLink,
  MinusCircle,
  Receipt,
  FileSignature,
} from "lucide-react";
import { QuickVenteFromPoseDialog } from "./QuickVenteFromPoseDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
// removed: useDeleteEntity (custom delete handles vente reset)
import { useRdvActions } from "@/hooks/useRdvActions";
import { DecomDialog } from "@/components/crm/DecomDialog";
import {
  VenteStatus,
  VENTE_STATUS_LABELS,
  VENTE_STATUS_COLORS,
  VENTE_STATUS_OPTIONS,
} from "@/lib/venteStatusConfig";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InstallationContextMenuProps {
  rdv: {
    id: string;
    client: string;
    clientId: string;
    time: string;
    date: Date;
    regieId?: string | null;
    regieNom?: string | null;
    regieCouleur?: string | null;
    phone?: string | null;
    address?: string;
    city?: string;
    postalCode?: string;
    venteId?: string | null;
    commissionNette?: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onMoveRequest?: () => void;
  onRefresh?: () => void;
}

interface VenteRow {
  id: string;
  status: VenteStatus;
  decom_montant: number | null;
  decom_raison: string | null;
  montant_ttc: number | null;
}

export function InstallationContextMenu({
  rdv,
  isOpen,
  onClose,
  onMoveRequest,
  onRefresh,
}: InstallationContextMenuProps) {
  const navigate = useNavigate();
  const [canClose, setCanClose] = useState(false);
  const [vente, setVente] = useState<VenteRow | null>(null);
  const [loadingVente, setLoadingVente] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [decomOpen, setDecomOpen] = useState(false);
  const [createVenteOpen, setCreateVenteOpen] = useState(false);

  const { callPhone, openWhatsApp, openClient, openClientDocuments, openWaze, openGoogleMaps, openAppleMaps } =
    useRdvActions({ onRefresh });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const STATUSES_TO_RESET: VenteStatus[] = [
    "envoi_pose",
    "en_installation",
    "installe",
    "attente_paiement",
  ];

  const resetVenteToEnvoiPose = async () => {
    if (!vente?.id) return;
    if (!STATUSES_TO_RESET.includes(vente.status)) return;
    const { error } = await supabase
      .from("ventes")
      .update({
        status: "envoi_pose",
        date_installation_reelle: null,
        date_installation_prevue: null,
      })
      .eq("id", vente.id);
    if (error) throw error;
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await resetVenteToEnvoiPose();
      const { error } = await supabase.from("rdv").delete().eq("id", rdv.id);
      if (error) throw error;
      toast.success("RDV de pose supprimé. Vente remise en « Envoi en pose ».");
      setIsDeleteDialogOpen(false);
      onRefresh?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de la suppression");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReportNoDate = async () => {
    setIsProcessing(true);
    try {
      await resetVenteToEnvoiPose();
      const { error } = await supabase.from("rdv").delete().eq("id", rdv.id);
      if (error) throw error;
      toast.success("Pose reportée. Vente remise en « Envoi en pose ».");
      setIsReportDialogOpen(false);
      onRefresh?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors du report");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      const t = setTimeout(() => setCanClose(true), 500);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Charger la vente associée
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingVente(true);
      try {
        let q = supabase
          .from("ventes")
          .select("id, status, decom_montant, decom_raison, montant_ttc")
          .eq("client_id", rdv.clientId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (rdv.venteId) {
          q = supabase
            .from("ventes")
            .select("id, status, decom_montant, decom_raison, montant_ttc")
            .eq("id", rdv.venteId)
            .limit(1);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setVente((data?.[0] as VenteRow) || null);
      } catch (e) {
        console.error("[InstallationContextMenu] load vente", e);
      } finally {
        if (!cancelled) setLoadingVente(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, rdv.clientId, rdv.venteId]);

  const handleBackdrop = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (canClose) onClose();
  };

  const handleOpenVente = () => {
    if (!vente?.id) {
      toast.error("Aucune vente liée à ce RDV de pose");
      return;
    }
    navigate(`/ventes/${vente.id}`);
    onClose();
  };

  const handleOpenClient = () => {
    openClient(rdv.clientId);
    onClose();
  };

  const handleDocuments = () => {
    openClientDocuments(rdv.clientId);
    onClose();
  };

  const handleMove = () => {
    onMoveRequest?.();
    onClose();
  };

  const handleVenteStatusChange = async (newStatus: VenteStatus) => {
    if (!vente?.id) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from("ventes").update({ status: newStatus }).eq("id", vente.id);
      if (error) throw error;
      setVente({ ...vente, status: newStatus });
      toast.success(`Vente : ${VENTE_STATUS_LABELS[newStatus]}`);
      onRefresh?.();
    } catch (e) {
      console.error(e);
      toast.error("Erreur mise à jour statut vente");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <>
      {createPortal(
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-[100]"
              onClick={handleBackdrop}
              onTouchEnd={handleBackdrop}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[101] flex items-end justify-center sm:items-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-h-[85vh] overflow-y-auto overscroll-contain safe-bottom bg-background rounded-t-2xl border-t shadow-2xl sm:rounded-2xl sm:border sm:max-w-lg sm:w-[calc(100%-2rem)] sm:max-h-[80vh]"
              >
              <div className="flex justify-center pt-3 pb-2 sm:hidden">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 pb-3 pt-2 sm:pt-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-500 text-white text-xs px-2 py-0.5 flex items-center gap-1 rounded-full">
                        <HardHat className="h-3 w-3" />
                        Pose
                      </Badge>
                      {rdv.regieNom && (
                        <Badge
                          className="text-xs px-2 py-0.5 flex items-center gap-1 rounded-full"
                          style={{
                            backgroundColor: rdv.regieCouleur ? `${rdv.regieCouleur}20` : undefined,
                            color: rdv.regieCouleur || undefined,
                            borderColor: rdv.regieCouleur ? `${rdv.regieCouleur}50` : undefined,
                            borderWidth: "1px",
                          }}
                        >
                          <Building2 className="h-3 w-3" />
                          {rdv.regieNom}
                        </Badge>
                      )}
                      {vente && (
                        <Badge className={`${VENTE_STATUS_COLORS[vente.status]} text-xs`}>
                          {VENTE_STATUS_LABELS[vente.status]}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-foreground truncate">{rdv.client}</h3>
                    <p className="text-sm text-muted-foreground">{rdv.time}</p>
                    {rdv.commissionNette != null && (
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                        Commission : {rdv.commissionNette.toLocaleString("fr-FR")} €
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-10 w-10 min-h-[44px] min-w-[44px] flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {rdv.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2.5 mt-3">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary/70" />
                    <span className="leading-relaxed">
                      {[rdv.address, rdv.postalCode, rdv.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 space-y-4">
                {/* Quick actions */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    className="h-14 flex-col gap-1"
                    onClick={() => callPhone(rdv.phone)}
                    disabled={!rdv.phone}
                  >
                    <Phone className="h-5 w-5" />
                    <span className="text-xs">Appeler</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-14 flex-col gap-1"
                    onClick={() => openWhatsApp(rdv.phone)}
                    disabled={!rdv.phone}
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-xs">WhatsApp</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        className="h-14 flex-col gap-1 bg-gradient-hero"
                        disabled={!rdv.address}
                      >
                        <Navigation className="h-5 w-5" />
                        <span className="text-xs">Itinéraire</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-48 z-[200]">
                      <DropdownMenuItem
                        onClick={() => openWaze(rdv.address, rdv.postalCode, rdv.city)}
                        className="gap-2 cursor-pointer"
                      >
                        <Navigation className="h-4 w-4 text-[#33ccff]" /> Waze
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openGoogleMaps(rdv.address, rdv.postalCode, rdv.city)}
                        className="gap-2 cursor-pointer"
                      >
                        <Map className="h-4 w-4 text-[#4285f4]" /> Google Maps
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openAppleMaps(rdv.address, rdv.postalCode, rdv.city)}
                        className="gap-2 cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 text-[#007aff]" /> Plans (Apple)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" className="h-14 flex-col gap-1" onClick={handleOpenClient}>
                    <FolderOpen className="h-5 w-5" />
                    <span className="text-xs">Client</span>
                  </Button>
                </div>

                {/* Statut de vente */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Statut de la vente
                  </p>
                  {loadingVente ? (
                    <div className="h-10 flex items-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement…
                    </div>
                  ) : vente ? (
                    <Select
                      value={vente.status}
                      onValueChange={(v) => handleVenteStatusChange(v as VenteStatus)}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {VENTE_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Button
                      variant="default"
                      className="w-full h-11 gap-2 bg-primary hover:bg-primary/90"
                      onClick={() => setCreateVenteOpen(true)}
                    >
                      <FileSignature className="h-4 w-4" />
                      Créer la vente
                    </Button>
                  )}
                </div>

                {/* Action grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="default"
                    className="h-12 flex-row gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleOpenVente}
                    disabled={!vente?.id}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm">Ouvrir la vente</span>
                  </Button>

                  <Button variant="outline" className="h-12 flex-row gap-2" onClick={handleDocuments}>
                    <Receipt className="h-4 w-4" />
                    <span className="text-sm">Documents</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-12 flex-row gap-2"
                    onClick={() => setDecomOpen(true)}
                    disabled={!vente?.id}
                  >
                    <MinusCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">
                      {vente && (vente.decom_montant || 0) > 0
                        ? `Décom: ${vente.decom_montant} €`
                        : "Ajouter décom"}
                    </span>
                  </Button>

                  {onMoveRequest && (
                    <Button variant="outline" className="h-12 flex-row gap-2" onClick={handleMove}>
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Reporter</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="h-12 flex-row gap-2 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => setIsReportDialogOpen(true)}
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Reporter sans date</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-12 flex-row gap-2 text-destructive hover:bg-destructive/10 col-span-2"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-sm">Supprimer la pose</span>
                  </Button>
                </div>
              </div>

              <div className="h-20 sm:h-6" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
        document.body
      )}

      {vente && (
        <DecomDialog
          venteId={vente.id}
          clientName={rdv.client}
          currentDecom={vente.decom_montant || 0}
          currentRaison={vente.decom_raison}
          open={decomOpen}
          onOpenChange={setDecomOpen}
          onSaved={() => {
            onRefresh?.();
            // refresh local vente
            setVente((v) => v && { ...v });
          }}
        />
      )}

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(o) => !o && setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Supprimer ce RDV de pose ?"
        description={`Le RDV de pose pour ${rdv.client} sera supprimé et la vente sera remise en « Envoi en pose » (date d'installation effacée).`}
        isLoading={isProcessing}
      />

      <DeleteConfirmDialog
        open={isReportDialogOpen}
        onOpenChange={(o) => !o && setIsReportDialogOpen(false)}
        onConfirm={handleConfirmReportNoDate}
        title="Reporter la pose sans nouvelle date ?"
        description={`Le RDV de pose pour ${rdv.client} sera retiré du planning et la vente repassera en « Envoi en pose ». Vous pourrez replanifier la pose plus tard.`}
        isLoading={isProcessing}
      />

      <QuickVenteFromPoseDialog
        open={createVenteOpen}
        onOpenChange={setCreateVenteOpen}
        clientId={rdv.clientId}
        clientName={rdv.client}
        rdvId={rdv.id}
        rdvDate={rdv.date instanceof Date ? rdv.date.toISOString().split("T")[0] : undefined}
        regieId={rdv.regieId}
        onSuccess={() => {
          onRefresh?.();
          // re-trigger vente loader
          setVente(null);
          setLoadingVente(true);
          supabase
            .from("ventes")
            .select("id, status, decom_montant, decom_raison, montant_ttc")
            .eq("client_id", rdv.clientId)
            .order("created_at", { ascending: false })
            .limit(1)
            .then(({ data }) => {
              setVente((data?.[0] as VenteRow) || null);
              setLoadingVente(false);
            });
        }}
      />
    </>
  );
}
