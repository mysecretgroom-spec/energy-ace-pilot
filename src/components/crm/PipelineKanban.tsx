import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Euro,
  User,
  Clock,
  CheckCircle2,
  TrendingUp,
  XCircle,
  GripVertical,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { WhatsAppConfirmDialog } from "@/components/notifications/WhatsAppConfirmDialog";

type VenteStatus = 'en_negociation' | 'signe' | 'cq_a_faire' | 'cq_fait' | 'attente_financement' | 'envoi_pose' | 'en_installation' | 'installe' | 'attente_paiement' | 'paye' | 'annule' | 'refus_financement';

interface Vente {
  id: string;
  numero_contrat: string | null;
  date_signature: string | null;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  status: VenteStatus;
  notes: string | null;
  created_at: string;
  regie_id?: string | null;
  client: {
    id: string;
    nom: string;
    prenom: string | null;
  } | null;
}

interface PipelineKanbanProps {
  ventes: Vente[];
  onRefresh: () => void;
}

const pipelineColumns: { status: VenteStatus; label: string; color: string; bgColor: string; icon: React.ReactNode }[] = [
  { 
    status: 'signe', 
    label: 'Signé', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-200',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  { 
    status: 'cq_a_faire', 
    label: 'CQ à faire', 
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10 border-orange-200',
    icon: <Clock className="h-4 w-4" />
  },
  { 
    status: 'cq_fait', 
    label: 'CQ fait', 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-500/10 border-cyan-200',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  { 
    status: 'attente_financement', 
    label: 'Att. Financement', 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10 border-yellow-200',
    icon: <Clock className="h-4 w-4" />
  },
  { 
    status: 'envoi_pose', 
    label: 'Envoi pose', 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500/10 border-indigo-200',
    icon: <TrendingUp className="h-4 w-4" />
  },
  { 
    status: 'installe', 
    label: 'Posé', 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10 border-emerald-200',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
  { 
    status: 'attente_paiement', 
    label: 'Att. Paiement', 
    color: 'text-pink-600',
    bgColor: 'bg-pink-500/10 border-pink-200',
    icon: <Clock className="h-4 w-4" />
  },
  { 
    status: 'paye', 
    label: 'Payé', 
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 border-green-200',
    icon: <Euro className="h-4 w-4" />
  },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
};

// Map vente status to WhatsApp classification
const venteStatusToClassification: Record<VenteStatus, string | null> = {
  en_negociation: null,
  signe: "positif",
  cq_a_faire: null,
  cq_fait: null,
  attente_financement: null,
  envoi_pose: null,
  en_installation: null,
  installe: "installe",
  attente_paiement: null,
  paye: "paye",
  annule: "annule",
  refus_financement: "annule",
};

export const PipelineKanban = memo(function PipelineKanban({ ventes, onRefresh }: PipelineKanbanProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  
  // WhatsApp dialog state
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{
    venteId: string;
    clientName: string;
    clientPrenom?: string;
    classification: string;
    regieId?: string | null;
  } | null>(null);
  const [skipWhatsAppPrompt, setSkipWhatsAppPrompt] = useState(false);

  // Load WhatsApp settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("settings_notifications")
        .select("skip_whatsapp_prompt, whatsapp_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setSkipWhatsAppPrompt(data.skip_whatsapp_prompt || !data.whatsapp_enabled);
      }
    };
    
    loadSettings();
  }, [user]);

  const handleDragStart = (e: React.DragEvent, venteId: string) => {
    e.dataTransfer.setData("venteId", venteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: VenteStatus) => {
    e.preventDefault();
    const venteId = e.dataTransfer.getData("venteId");
    
    if (!venteId) return;

    // Find the vente to get client info and previous status
    const vente = ventes.find(v => v.id === venteId);
    if (!vente) return;
    
    const previousStatus = vente.status;
    if (previousStatus === newStatus) return;

    try {
      const { error } = await supabase
        .from("ventes")
        .update({ status: newStatus })
        .eq("id", venteId);

      if (error) throw error;
      
      toast.success("Statut mis à jour");
      onRefresh();

      // Show WhatsApp dialog if classification exists for new status
      const classification = venteStatusToClassification[newStatus];
      if (classification && !skipWhatsAppPrompt && vente.client) {
        setPendingWhatsApp({
          venteId,
          clientName: vente.client.nom,
          clientPrenom: vente.client.prenom || undefined,
          classification,
          regieId: vente.regie_id || null,
        });
        setShowWhatsAppDialog(true);
      }
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleWhatsAppConfirm = async () => {
    if (!pendingWhatsApp || !user) return;
    
    await sendWhatsAppNotification({
      clientName: pendingWhatsApp.clientName,
      clientPrenom: pendingWhatsApp.clientPrenom,
      classification: pendingWhatsApp.classification,
      userId: user.id,
      regieId: pendingWhatsApp.regieId,
    });
    
    setPendingWhatsApp(null);
  };

  const handleWhatsAppCancel = () => {
    setPendingWhatsApp(null);
  };

  const getVentesByStatus = (status: VenteStatus) => {
    return ventes.filter(v => v.status === status);
  };

  const getColumnTotal = (status: VenteStatus) => {
    return getVentesByStatus(status).reduce((sum, v) => sum + v.montant_ttc, 0);
  };

  // Filter out cancelled sales for the pipeline
  const activeVentes = ventes.filter(v => v.status !== 'annule');
  const cancelledVentes = ventes.filter(v => v.status === 'annule');

  // Calculate conversion stats
  const conversionStats = pipelineColumns.map((col, index) => {
    const currentCount = getVentesByStatus(col.status).length;
    const currentValue = getColumnTotal(col.status);
    const totalOpportunities = activeVentes.length;
    const conversionFromStart = totalOpportunities > 0 
      ? Math.round((currentCount / totalOpportunities) * 100) 
      : 0;
    
    // Conversion to next stage
    let conversionToNext = 0;
    if (index < pipelineColumns.length - 1 && currentCount > 0) {
      const nextStageCount = pipelineColumns
        .slice(index + 1)
        .reduce((sum, nextCol) => sum + getVentesByStatus(nextCol.status).length, 0);
      conversionToNext = Math.round((nextStageCount / (currentCount + nextStageCount)) * 100) || 0;
    }
    
    return {
      ...col,
      count: currentCount,
      value: currentValue,
      conversionFromStart,
      conversionToNext,
    };
  });

  // Calculate stage-to-stage conversion rates
  const stageConversions = pipelineColumns.slice(0, -1).map((col, index) => {
    const currentAndBeyond = pipelineColumns
      .slice(index)
      .reduce((sum, c) => sum + getVentesByStatus(c.status).length, 0);
    const nextAndBeyond = pipelineColumns
      .slice(index + 1)
      .reduce((sum, c) => sum + getVentesByStatus(c.status).length, 0);
    
    const rate = currentAndBeyond > 0 
      ? Math.round((nextAndBeyond / currentAndBeyond) * 100) 
      : 0;
    
    return {
      from: col.label,
      to: pipelineColumns[index + 1].label,
      rate,
      fromColor: col.color,
      toColor: pipelineColumns[index + 1].color,
    };
  });

  // Overall conversion rate (from négociation to payé)
  const negoCount = getVentesByStatus('en_negociation').length + 
    getVentesByStatus('signe').length + 
    getVentesByStatus('en_installation').length + 
    getVentesByStatus('installe').length + 
    getVentesByStatus('paye').length;
  const payeCount = getVentesByStatus('paye').length;
  const overallConversion = negoCount > 0 ? Math.round((payeCount / negoCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Conversion Funnel Stats */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Tunnel de conversion
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {/* Overall conversion */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taux global</span>
            <span className="font-bold text-primary">{overallConversion}%</span>
          </div>
          <Progress value={overallConversion} className="h-2" />
          
          {/* Stage-to-stage conversions */}
          <div className="space-y-2 pt-2">
            {stageConversions.map((conv, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className={`${conv.fromColor} font-medium truncate flex-1`}>
                  {conv.from}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className={`${conv.toColor} font-medium truncate flex-1`}>
                  {conv.to}
                </span>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ml-1 ${conv.rate >= 70 ? 'bg-green-100 text-green-700' : conv.rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                >
                  {conv.rate}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pipeline actif</p>
            <p className="text-lg font-bold">{activeVentes.length} ventes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Valeur totale</p>
            <p className="text-lg font-bold">{formatCurrency(activeVentes.reduce((sum, v) => sum + v.montant_ttc, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board - Vertical Layout */}
      <div className="space-y-3">
        {pipelineColumns.map((column) => {
          const columnVentes = getVentesByStatus(column.status);
          const columnTotal = getColumnTotal(column.status);
          
          return (
            <Card
              key={column.status}
              className={`${column.bgColor} border`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={column.color}>{column.icon}</span>
                    <CardTitle className={`text-sm font-medium ${column.color}`}>
                      {column.label}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(columnTotal)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {columnVentes.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                {columnVentes.length === 0 ? (
                  <div className="h-16 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Glissez ici</p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {columnVentes.map((vente) => (
                      <Card
                        key={vente.id}
                        className="bg-background cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        draggable
                        onDragStart={(e) => handleDragStart(e, vente.id)}
                        onClick={() => navigate(`/ventes/${vente.id}`)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <p className="text-sm font-medium truncate">
                                  {vente.client?.nom} {vente.client?.prenom || ""}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-primary">
                                {formatCurrency(vente.montant_ttc)}
                              </p>
                              {vente.puissance_kwc && (
                                <p className="text-xs text-muted-foreground">
                                  {vente.puissance_kwc} kWc
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cancelled sales */}
      {cancelledVentes.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Ventes annulées ({cancelledVentes.length})
            </h3>
          </div>
          <div className="grid gap-2">
            {cancelledVentes.slice(0, 3).map((vente) => (
              <Card 
                key={vente.id} 
                className="bg-red-500/5 border-red-200 opacity-60 cursor-pointer hover:opacity-80"
                onClick={() => navigate(`/ventes/${vente.id}`)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm">
                    {vente.client?.nom} {vente.client?.prenom || ""}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(vente.montant_ttc)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Confirm Dialog */}
      <WhatsAppConfirmDialog
        open={showWhatsAppDialog}
        onOpenChange={setShowWhatsAppDialog}
        onConfirm={handleWhatsAppConfirm}
        onCancel={handleWhatsAppCancel}
        clientName={[pendingWhatsApp?.clientPrenom, pendingWhatsApp?.clientName].filter(Boolean).join(" ")}
        classification={pendingWhatsApp?.classification || "positif"}
      />
    </div>
  );
});
