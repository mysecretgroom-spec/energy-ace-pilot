import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  User, 
  Calendar, 
  ChevronRight, 
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Euro,
  MinusCircle,
  Wrench,
  AlertTriangle,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DecomDialog } from "./DecomDialog";
import { VenteProgressBar } from "./VenteProgressBar";

import { VenteStatus, VENTE_STATUS_LABELS, VENTE_STATUS_COLORS } from "@/lib/venteStatusConfig";
import { getVenteCardDateDisplay } from "@/lib/venteCardDateDisplay";
type VenteType = 'standard' | 'external_installation';

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  date_installation_prevue?: string | null;
  date_installation_reelle?: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  type_vente?: VenteType;
  decom_montant?: number | null;
  decom_raison?: string | null;
  regie_id?: string | null;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface Regie {
  id: string;
  nom: string;
  couleur: string;
}

interface CommissionData {
  commissionBase: number;
  bonusSurvente: number;
  decomMontant: number;
  commissionNette: number;
  isInterpolated?: boolean;
  mode?: "bouquet" | "pourcentage";
  tauxApplique?: number;
}

interface VenteCardProps {
  vente: Vente;
  commission?: CommissionData | null;
  regies?: Regie[];
  selectionMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  onRefresh?: () => void;
}

const statusConfig: Record<VenteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  en_negociation: { label: "En négociation", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  signe: { label: "Signé", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  cq_a_faire: { label: "CQ à faire", color: "bg-orange-500/10 text-orange-600 border-orange-200", icon: <Clock className="h-3 w-3" /> },
  cq_fait: { label: "CQ fait", color: "bg-cyan-500/10 text-cyan-600 border-cyan-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  attente_financement: { label: "Att. financement", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200", icon: <Clock className="h-3 w-3" /> },
  envoi_pose: { label: "Envoi en pose", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200", icon: <TrendingUp className="h-3 w-3" /> },
  en_installation: { label: "En installation", color: "bg-purple-500/10 text-purple-600 border-purple-200", icon: <TrendingUp className="h-3 w-3" /> },
  installe: { label: "Posé", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  attente_paiement: { label: "Att. paiement", color: "bg-pink-500/10 text-pink-600 border-pink-200", icon: <Clock className="h-3 w-3" /> },
  paye: { label: "Payé", color: "bg-green-500/10 text-green-600 border-green-200", icon: <Euro className="h-3 w-3" /> },
  annule: { label: "Annulé", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  refus_financement: { label: "Refus financement", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  inFinancable: { label: "Infinançable", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  retracte: { label: "Rétracté", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  refus_mairie_abf: { label: "Refus Mairie / ABF", color: "bg-red-500/10 text-red-600 border-red-200", icon: <XCircle className="h-3 w-3" /> },
};

const formatCurrency = (amount: number) => {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
};

export const VenteCard = ({ vente, commission, regies, selectionMode, isSelected, onClick, onRefresh }: VenteCardProps) => {
  const [decomDialogOpen, setDecomDialogOpen] = useState(false);
  const config = statusConfig[vente.status];
  const decomMontant = commission?.decomMontant || vente.decom_montant || 0;
  const rawCommission = commission ? commission.commissionBase + commission.bonusSurvente : 0;
  const totalCommission = Math.max(0, rawCommission - decomMontant);
  const isExternalInstallation = vente.type_vente === 'external_installation';

  // Find the regie for this vente
  const regie = vente.regie_id && regies ? regies.find(r => r.id === vente.regie_id) : null;

  const clientName = vente.client 
    ? `${vente.client.prenom || ""} ${vente.client.nom}`.trim() 
    : "Client";

  const handleDecomClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDecomDialogOpen(true);
  };

  return (
    <>
      <Card 
        className={`cursor-pointer hover:bg-muted/50 transition-colors relative ${isSelected ? "border-primary bg-primary/5" : ""} ${isExternalInstallation ? "border-l-4 border-l-amber-500" : ""}`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {selectionMode && (
                <Checkbox checked={isSelected} className="mr-1" />
              )}
              {isExternalInstallation ? (
                <Wrench className="h-4 w-4 text-amber-600" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">
                {vente.client?.nom} {vente.client?.prenom || ""}
              </span>
              {regie && (
                <span 
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: regie.couleur }}
                >
                  {regie.nom}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isExternalInstallation && (
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                  <Wrench className="h-2.5 w-2.5 mr-0.5" />
                  Externe
                </Badge>
              )}
              <Badge className={`${config.color} flex items-center gap-1`}>
                {config.icon}
                {config.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {/* Pour les ventes externes: afficher uniquement la commission (= montant_ht) */}
              {isExternalInstallation ? (
                <p className="text-lg font-bold text-amber-600">
                  Commission: {formatCurrency(vente.montant_ht)}
                </p>
              ) : (
                <>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(vente.montant_ttc)}
                  </p>
                </>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {vente.puissance_kwc && !isExternalInstallation && (
                  <span className="text-xs text-muted-foreground">
                    {vente.puissance_kwc} kWc
                  </span>
                )}
                {/* Pour les ventes standard: afficher le détail des commissions calculées */}
                {rawCommission > 0 && !isExternalInstallation && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={`text-xs cursor-pointer hover:opacity-80 ${commission?.isInterpolated ? "bg-amber-500/10 text-amber-600 border-amber-200" : "bg-green-500/10 text-green-600 border-green-200"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {commission?.isInterpolated && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                        <Info className="h-2.5 w-2.5 mr-0.5" />
                        Com: {formatCurrency(totalCommission)}
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-64 p-3" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-1">
                          <Euro className="h-4 w-4 text-primary" />
                          Détail de la commission
                        </h4>
                        
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {commission?.mode === "pourcentage" 
                                ? `Commission (${commission?.tauxApplique || 0}%)` 
                                : "Commission fixe"}
                            </span>
                            <span className="font-medium">{formatCurrency(commission?.commissionBase || 0)}</span>
                          </div>
                          
                          {(commission?.bonusSurvente || 0) > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>+ {commission?.mode === "pourcentage" ? "Bonus tranche" : "Survente"}</span>
                              <span className="font-medium">+{formatCurrency(commission?.bonusSurvente || 0)}</span>
                            </div>
                          )}
                          
                          {decomMontant > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>- Décom</span>
                              <span className="font-medium">-{formatCurrency(decomMontant)}</span>
                            </div>
                          )}
                          
                          <div className="border-t pt-1.5 mt-1.5">
                            <div className="flex justify-between font-semibold">
                              <span>Commission nette</span>
                              <span className="text-primary">{formatCurrency(totalCommission)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {commission?.isInterpolated && (
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2 flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            Prix interpolé (pas de bouquet exact pour {vente.puissance_kwc} kWc)
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {decomMontant > 0 && !isExternalInstallation && (
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-200">
                    Décom: -{formatCurrency(decomMontant)}
                  </Badge>
                )}
                {!selectionMode && !isExternalInstallation && (
                  <Button
                    variant="ghost"
                    
                    className="h-11 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleDecomClick}
                  >
                    <MinusCircle className="h-3 w-3 mr-1" />
                    Décom
                  </Button>
                )}
              </div>
            </div>
            <div className="text-right space-y-1">
              {(() => {
                const display = getVenteCardDateDisplay(vente);
                if (!display) return null;
                if (display.kind === "install") {
                  return (
                    <p className="text-xs flex items-center gap-1 text-muted-foreground justify-end">
                      <Calendar className="h-3 w-3" />
                      <span>{display.label} {format(new Date(display.date), "d MMM yyyy", { locale: fr })}</span>
                    </p>
                  );
                }
                return (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground justify-end">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(display.date), "d MMM yyyy", { locale: fr })}
                  </p>
                );
              })()}
              {vente.numero_contrat && (
                <p className="text-xs text-muted-foreground">
                  {vente.numero_contrat}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <VenteProgressBar status={vente.status} className="mt-3" />

          {!selectionMode && (
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      <DecomDialog
        venteId={vente.id}
        clientName={clientName}
        currentDecom={decomMontant}
        currentRaison={vente.decom_raison || null}
        open={decomDialogOpen}
        onOpenChange={setDecomDialogOpen}
        onSaved={() => onRefresh?.()}
      />
    </>
  );
};
