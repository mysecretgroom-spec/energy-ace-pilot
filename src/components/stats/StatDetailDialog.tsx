import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Phone, MessageCircle, MapPin, FolderOpen, MoreVertical, MinusCircle, RefreshCw, Trash2 } from "lucide-react";
import { useRdvActions } from "@/hooks/useRdvActions";
import { DecomDialog } from "@/components/crm/DecomDialog";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { useDeleteEntity } from "@/hooks/useDeleteEntity";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StatDetailItem {
  id: string;
  label: string;
  sublabel?: string;
  value?: number;
  valueLabel?: string;
  date?: string;
  status?: string;
  statusColor?: string;
  navigateTo?: string;
  // Quick action data
  phone?: string | null;
  clientId?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  // Vente-specific action data
  venteId?: string | null;
  venteStatus?: string | null;
  clientName?: string | null;
  decomMontant?: number;
  decomRaison?: string | null;
  montantHt?: number;
}

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule' | 'refus_financement';

const STATUS_LABELS: Record<VenteStatus, string> = {
  en_negociation: "En négociation",
  signe: "Signé",
  cq_a_faire: "CQ à faire",
  cq_fait: "CQ fait",
  attente_financement: "Att. financement",
  envoi_pose: "Envoi pose",
  en_installation: "En installation",
  installe: "Posé",
  attente_paiement: "Att. paiement",
  paye: "Payé",
  annule: "Annulé",
  refus_financement: "Refus financement",
};

interface StatDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: StatDetailItem[];
  total?: number;
  totalLabel?: string;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
  onRefresh?: () => void;
}

export function StatDetailDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  total,
  totalLabel = "Total",
  emptyMessage = "Aucun élément",
  formatValue = (v) => `${v.toLocaleString("fr-FR")} €`,
  onRefresh,
}: StatDetailDialogProps) {
  const navigate = useNavigate();
  const { callPhone, openWhatsApp, openGoogleMaps } = useRdvActions();

  // Décom dialog state
  const [decomTarget, setDecomTarget] = useState<StatDetailItem | null>(null);

  // Status change state
  const [statusTarget, setStatusTarget] = useState<StatDetailItem | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Delete
  const { isDeleteDialogOpen, isDeleting, openDeleteDialog, confirmDelete, cancelDelete } = useDeleteEntity({
    tableName: "ventes",
    entityName: "Vente",
    onSuccess: () => onRefresh?.(),
  });

  const handleItemClick = (item: StatDetailItem) => {
    if (item.navigateTo) {
      onOpenChange(false);
      navigate(item.navigateTo);
    }
  };

  const hasActions = (item: StatDetailItem) =>
    item.phone || item.clientId || item.address || item.city;

  const hasVenteActions = (item: StatDetailItem) => !!item.venteId;

  const handleStatusChange = async (venteId: string, newStatus: string) => {
    setStatusUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'installe') {
        updateData.date_installation_reelle = new Date().toISOString().split('T')[0];
      }
      const { error } = await supabase
        .from("ventes")
        .update(updateData)
        .eq("id", venteId);
      if (error) throw error;
      toast.success(`Statut → ${STATUS_LABELS[newStatus as VenteStatus] || newStatus}`);
      setStatusTarget(null);
      onRefresh?.();
    } catch {
      toast.error("Erreur lors du changement de statut");
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{title}</span>
              {total !== undefined && (
                <Badge variant="secondary" className="text-base font-bold">
                  {formatValue(total)}
                </Badge>
              )}
            </DialogTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border bg-card ${
                      item.navigateTo ? "cursor-pointer hover:bg-accent transition-colors" : ""
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-sm text-muted-foreground truncate">{item.sublabel}</p>
                        )}
                        {item.date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.date), "d MMM yyyy", { locale: fr })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col items-end gap-1">
                          {item.value !== undefined && (
                            <span className="font-semibold text-primary whitespace-nowrap">
                              {item.valueLabel || formatValue(item.value)}
                            </span>
                          )}
                          {item.status && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={item.statusColor ? { 
                                borderColor: item.statusColor, 
                                color: item.statusColor 
                              } : undefined}
                            >
                              {item.status}
                            </Badge>
                          )}
                        </div>
                        {hasVenteActions(item) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => setDecomTarget(item)}>
                                <MinusCircle className="h-4 w-4 mr-2" />
                                Décom
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatusTarget(item)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Modifier statut
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteDialog(item.venteId!)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    {hasActions(item) && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                        {item.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); callPhone(item.phone); }}
                          >
                            <Phone className="h-3 w-3" />
                            Appeler
                          </Button>
                        )}
                        {item.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); openWhatsApp(item.phone); }}
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </Button>
                        )}
                        {(item.address || item.city) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); openGoogleMaps(item.address || undefined, item.postalCode || undefined, item.city || undefined); }}
                          >
                            <MapPin className="h-3 w-3" />
                            GPS
                          </Button>
                        )}
                        {item.clientId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); onOpenChange(false); navigate(`/clients/${item.clientId}`); }}
                          >
                            <FolderOpen className="h-3 w-3" />
                            Dossier
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {total !== undefined && items.length > 0 && (
            <div className="pt-3 border-t mt-2">
              <div className="flex items-center justify-between font-semibold">
                <span>{totalLabel} ({items.length} éléments)</span>
                <span className="text-primary text-lg">{formatValue(total)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Décom Dialog */}
      {decomTarget?.venteId && (
        <DecomDialog
          venteId={decomTarget.venteId}
          clientName={decomTarget.clientName || decomTarget.label}
          currentDecom={decomTarget.decomMontant ?? 0}
          currentRaison={decomTarget.decomRaison ?? null}
          open={!!decomTarget}
          onOpenChange={(o) => { if (!o) setDecomTarget(null); }}
          onSaved={() => { setDecomTarget(null); onRefresh?.(); }}
        />
      )}

      {/* Status Change Dialog */}
      {statusTarget?.venteId && (
        <Dialog open={!!statusTarget} onOpenChange={(o) => { if (!o) setStatusTarget(null); }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-base">Modifier le statut</DialogTitle>
              <p className="text-sm text-muted-foreground">{statusTarget.clientName || statusTarget.label}</p>
            </DialogHeader>
            <Select
              defaultValue={statusTarget.venteStatus || undefined}
              onValueChange={(val) => handleStatusChange(statusTarget.venteId!, val)}
              disabled={statusUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={cancelDelete}
        onConfirm={confirmDelete}
        title="Supprimer la vente"
        description="Cette action est irréversible. Toutes les données liées seront perdues."
        isLoading={isDeleting}
      />
    </>
  );
}
