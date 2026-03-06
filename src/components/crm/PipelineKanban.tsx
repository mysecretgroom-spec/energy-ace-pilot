import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  TrendingDown,
  Target,
  BarChart3,
  AlertTriangle,
  Ban,
  ShieldX,
  Undo2,
  Building,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

import {
  VenteStatus,
  CANCELLATION_STATUSES,
  VENTE_STATUS_LABELS,
  isCancellationStatus,
} from "@/lib/venteStatusConfig";

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
  { status: 'signe', label: 'Signé', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-200', icon: <CheckCircle2 className="h-4 w-4" /> },
  { status: 'cq_a_faire', label: 'CQ à faire', color: 'text-orange-600', bgColor: 'bg-orange-500/10 border-orange-200', icon: <Clock className="h-4 w-4" /> },
  { status: 'cq_fait', label: 'CQ fait', color: 'text-cyan-600', bgColor: 'bg-cyan-500/10 border-cyan-200', icon: <CheckCircle2 className="h-4 w-4" /> },
  { status: 'attente_financement', label: 'Att. Financement', color: 'text-yellow-600', bgColor: 'bg-yellow-500/10 border-yellow-200', icon: <Clock className="h-4 w-4" /> },
  { status: 'envoi_pose', label: 'Envoi pose', color: 'text-indigo-600', bgColor: 'bg-indigo-500/10 border-indigo-200', icon: <TrendingUp className="h-4 w-4" /> },
  { status: 'installe', label: 'Posé', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-200', icon: <CheckCircle2 className="h-4 w-4" /> },
  { status: 'attente_paiement', label: 'Att. Paiement', color: 'text-pink-600', bgColor: 'bg-pink-500/10 border-pink-200', icon: <Clock className="h-4 w-4" /> },
  { status: 'paye', label: 'Payé', color: 'text-green-600', bgColor: 'bg-green-500/10 border-green-200', icon: <Euro className="h-4 w-4" /> },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
};

const CANCELLATION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  annule: { label: "Annulé", icon: <XCircle className="h-4 w-4" />, color: "text-red-500" },
  refus_financement: { label: "Refus financement", icon: <Ban className="h-4 w-4" />, color: "text-red-600" },
  inFinancable: { label: "Infinançable", icon: <ShieldX className="h-4 w-4" />, color: "text-red-700" },
  retracte: { label: "Rétracté", icon: <Undo2 className="h-4 w-4" />, color: "text-orange-600" },
  refus_mairie_abf: { label: "Refus Mairie / ABF", icon: <Building className="h-4 w-4" />, color: "text-amber-700" },
};

export const PipelineKanban = memo(function PipelineKanban({ ventes, onRefresh }: PipelineKanbanProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rdvStats, setRdvStats] = useState<{ total: number; totalEffectif: number; signe: number; negatif: number; annule: number; r2: number; r2Signe: number; reporte: number; porte: number; nonFait: number } | null>(null);

  // Fetch RDV stats for performance index
  useEffect(() => {
    if (!user?.id) return;
    const fetchRdvStats = async () => {
      const { data, error } = await supabase
        .from("rdv")
        .select("status, is_r2, client_id, date_heure")
        .eq("user_id", user.id);
      if (error || !data) return;

      const stats = { total: data.length, totalEffectif: 0, signe: 0, negatif: 0, annule: 0, r2: 0, r2Signe: 0, reporte: 0, porte: 0, nonFait: 0 };
      
      // Build per-client date index: for each client, collect all RDV dates
      const clientRdvDates = new Map<string, Date[]>();
      const clientsWithSignature = new Set<string>();
      data.forEach((r: any) => {
        if (r.client_id && r.date_heure) {
          const dates = clientRdvDates.get(r.client_id) || [];
          dates.push(new Date(r.date_heure));
          clientRdvDates.set(r.client_id, dates);
        }
        if (r.status === "signe" && r.client_id) clientsWithSignature.add(r.client_id);
      });

      // Check if client has a later RDV after the given date
      const hasLaterRdv = (clientId: string | null, dateHeure: string | null): boolean => {
        if (!clientId || !dateHeure) return false;
        const refDate = new Date(dateHeure);
        const dates = clientRdvDates.get(clientId) || [];
        return dates.some(d => d.getTime() > refDate.getTime());
      };

      const r2ClientIds: string[] = [];

      data.forEach((r: any) => {
        if (r.status === "signe") stats.signe++;
        else if (r.status === "negatif") stats.negatif++;
        else if (r.status === "annule") {
          stats.annule++;
          if (!r.is_r2) stats.nonFait++;
        }
        else if (r.status === "porte") { stats.porte++; stats.nonFait++; }
        else if (r.status === "r2" || r.status === "r2_prestudy") {
          stats.r2++;
          if (r.client_id) r2ClientIds.push(r.client_id);
        }
        else if (r.status === "reporte") {
          stats.reporte++;
          // Only count as "non fait" if no subsequent RDV exists for same client
          if (!r.is_r2 && !hasLaterRdv(r.client_id, r.date_heure)) stats.nonFait++;
        }
      });

      // R2 → signature: R2 clients who also have a signed RDV
      stats.r2Signe = r2ClientIds.filter(cid => clientsWithSignature.has(cid)).length;

      stats.totalEffectif = stats.total - stats.nonFait;
      setRdvStats(stats);
    };
    fetchRdvStats();
  }, [user?.id]);

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
    const vente = ventes.find(v => v.id === venteId);
    if (!vente || vente.status === newStatus) return;

    try {
      const { error } = await supabase
        .from("ventes")
        .update({ status: newStatus })
        .eq("id", venteId);
      if (error) throw error;
      // Silent - visual kanban update is enough
      onRefresh();
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getVentesByStatus = (status: VenteStatus) => ventes.filter(v => v.status === status);
  const getColumnTotal = (status: VenteStatus) => getVentesByStatus(status).reduce((sum, v) => sum + v.montant_ttc, 0);

  // All ventes that entered the pipeline (signed or beyond, including cancelled)
  const allPipelineVentes = ventes.filter(v => v.status !== 'en_negociation');
  const cancelledVentes = ventes.filter(v => isCancellationStatus(v.status));
  const activeVentes = allPipelineVentes.filter(v => !isCancellationStatus(v.status));

  // TRUE conversion: signed that made it to payé vs total signed (including those that got cancelled)
  const totalSigned = allPipelineVentes.length; // everyone who was at least signed
  const payeCount = getVentesByStatus('paye').length;
  const conversionRate = totalSigned > 0 ? Math.round((payeCount / totalSigned) * 100) : 0;
  const cancellationRate = totalSigned > 0 ? Math.round((cancelledVentes.length / totalSigned) * 100) : 0;

  // Cancellation breakdown
  const cancellationBreakdown = CANCELLATION_STATUSES.map(status => ({
    status,
    count: getVentesByStatus(status).length,
    value: getColumnTotal(status),
    meta: CANCELLATION_META[status] || { label: status, icon: <XCircle className="h-4 w-4" />, color: "text-red-500" },
  })).filter(b => b.count > 0);

  const totalCancelledValue = cancelledVentes.reduce((sum, v) => sum + v.montant_ttc, 0);

  // Performance index from RDV — based on effective RDV (excluding annulé/reporté non-R2)
  const totalEffectif = rdvStats?.totalEffectif || 0;
  const signeRate = totalEffectif > 0 ? Math.round((rdvStats!.signe / totalEffectif) * 100) : 0;
  const negRate = totalEffectif > 0 ? Math.round((rdvStats!.negatif / totalEffectif) * 100) : 0;
  const r2Rate = totalEffectif > 0 ? Math.round((rdvStats!.r2 / totalEffectif) * 100) : 0;
  const porteRate = totalEffectif > 0 ? Math.round((rdvStats!.porte / totalEffectif) * 100) : 0;
  const nonFaitRate = rdvStats && rdvStats.total > 0 ? Math.round((rdvStats.nonFait / rdvStats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Commercial Performance Index */}
      {rdvStats && rdvStats.total > 0 && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Indice de performance commerciale
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{signeRate}%</p>
                <p className="text-xs text-muted-foreground">Taux signature</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{totalEffectif}</p>
                <p className="text-xs text-muted-foreground">RDV effectués</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{rdvStats.nonFait}</p>
                <p className="text-xs text-muted-foreground">Non faits</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Signés</span>
                </div>
                <span className="font-medium">{rdvStats.signe} ({signeRate}%)</span>
              </div>
              <Progress value={signeRate} className="h-1.5 [&>div]:bg-green-500" />

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  <span>R2 / Pré-étude</span>
                </div>
                <span className="font-medium">{rdvStats.r2} ({r2Rate}%)</span>
              </div>
              <Progress value={r2Rate} className="h-1.5 [&>div]:bg-blue-500" />
              {rdvStats.r2 > 0 && (
                <div className="flex items-center justify-between text-[11px] pl-4 text-muted-foreground">
                  <span>↳ R2 → Signé</span>
                  <span className="font-medium text-green-600">
                    {rdvStats.r2Signe}/{rdvStats.r2} ({Math.round((rdvStats.r2Signe / rdvStats.r2) * 100)}%)
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span>Négatifs</span>
                </div>
                <span className="font-medium">{rdvStats.negatif} ({negRate}%)</span>
              </div>
              <Progress value={negRate} className="h-1.5 [&>div]:bg-red-500" />

              {rdvStats.porte > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Ban className="h-3 w-3 text-amber-700" />
                      <span>Porte</span>
                    </div>
                    <span className="font-medium">{rdvStats.porte} ({porteRate}%)</span>
                  </div>
                  <Progress value={porteRate} className="h-1.5 [&>div]:bg-amber-700" />
                </>
              )}

              {rdvStats.nonFait > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      <span>Non faits (annulés/reportés)</span>
                    </div>
                    <span className="font-medium">{rdvStats.nonFait} ({nonFaitRate}% du total)</span>
                  </div>
                  <Progress value={nonFaitRate} className="h-1.5 [&>div]:bg-orange-500" />
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              Total: {rdvStats.total} RDV • Effectués: {totalEffectif} • Non faits: {rdvStats.nonFait} (hors R2)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Conversion & Cancellation Stats */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Conversion & Annulations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <p className="text-lg font-bold text-green-600">{conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">Conversion</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-600">{cancellationRate}%</p>
              <p className="text-[10px] text-muted-foreground">Annulations</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-lg font-bold text-primary">{totalSigned}</p>
              <p className="text-[10px] text-muted-foreground">Total pipeline</p>
            </div>
          </div>

          {/* Cancellation breakdown by reason */}
          {cancellationBreakdown.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Motifs d'annulation
              </p>
              {cancellationBreakdown.map((item) => {
                const pct = cancelledVentes.length > 0 ? Math.round((item.count / cancelledVentes.length) * 100) : 0;
                return (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1.5 ${item.meta.color}`}>
                        {item.meta.icon}
                        <span className="font-medium">{item.meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{formatCurrency(item.value)}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 bg-red-100 text-red-700">
                          {item.count} ({pct}%)
                        </Badge>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1 [&>div]:bg-red-400" />
                  </div>
                );
              })}
              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="font-medium text-red-600">Total perdu</span>
                <span className="font-bold text-red-600">{formatCurrency(totalCancelledValue)}</span>
              </div>
            </div>
          )}
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
            <p className="text-xs text-muted-foreground">Valeur active</p>
            <p className="text-lg font-bold">{formatCurrency(activeVentes.reduce((sum, v) => sum + v.montant_ttc, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
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

      {/* Cancelled sales with reason badges */}
      {cancelledVentes.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Ventes annulées ({cancelledVentes.length})
            </h3>
          </div>
          <div className="grid gap-2">
            {cancelledVentes.map((vente) => {
              const meta = CANCELLATION_META[vente.status] || CANCELLATION_META.annule;
              return (
                <Card
                  key={vente.id}
                  className="bg-red-500/5 border-red-200 cursor-pointer hover:bg-red-500/10 transition-colors"
                  onClick={() => navigate(`/ventes/${vente.id}`)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={meta.color}>{meta.icon}</span>
                      <span className="text-sm truncate">
                        {vente.client?.nom} {vente.client?.prenom || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">
                        {meta.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(vente.montant_ttc)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
