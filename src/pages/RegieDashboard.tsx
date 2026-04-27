import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
import { StatDetailDialog, StatDetailItem } from "@/components/stats/StatDetailDialog";
import {
  Calendar,
  Euro,
  TrendingUp,
  ArrowRight,
  Users,
  Loader2,
  BarChart3,
  Settings,
  ShoppingBag,
  Percent,
  Clock,
  Truck,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { isCancellationStatus } from "@/lib/venteStatusConfig";
import { RegieStatusLegend } from "@/components/regie/RegieStatusLegend";

interface RegieData {
  id: string;
  nom: string;
  couleur: string;
  actif: boolean;
}

interface VenteForCommission {
  id: string;
  montant_ht: number;
  montant_ttc: number;
  puissance_kwc: number | null;
  decom_montant: number | null;
  type_vente: 'standard' | 'external_installation';
  regie_id: string | null;
  etude_id: string | null;
  status: string;
}

interface VenteDetail {
  id: string;
  montant_ttc: number;
  status: string;
  date_signature: string | null;
  client_nom: string;
  client_prenom: string | null;
}

interface RdvDetail {
  id: string;
  date_heure: string;
  status: string;
  client_id: string;
  client_nom: string;
  client_prenom: string | null;
}

interface RegieStats {
  // Totaux
  rdvTotal: number;
  ventesTotal: number;
  caTotal: number;
  // Ce mois
  rdvMois: number;
  ventesMois: number;
  caMois: number;
  // Pipeline
  signes: number;
  poses: number;
  payes: number;
  annules: number;
  // Taux
  tauxConversion: number;
  panierMoyen: number;
}

type StatDialogType = 
  | "rdvTotal" | "rdvMois" 
  | "ventesTotal" | "ventesMois" 
  | "caTotal" | "caMois"
  | "signes" | "poses" | "payes" | "annules"
  | "commEnAttente" | "commAVenir" | "commDuSur" | "commPayees"
  | null;

const RegieDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [regie, setRegie] = useState<RegieData | null>(null);
  const [stats, setStats] = useState<RegieStats | null>(null);
  const [ventesForCommission, setVentesForCommission] = useState<VenteForCommission[]>([]);
  
  // Detail data
  const [allVentes, setAllVentes] = useState<VenteDetail[]>([]);
  const [allRdvs, setAllRdvs] = useState<RdvDetail[]>([]);
  const [rdvsMois, setRdvsMois] = useState<RdvDetail[]>([]);
  const [ventesMoisDetail, setVentesMoisDetail] = useState<VenteDetail[]>([]);
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState<StatDialogType>(null);

  // Calculate commissions using the hook
  const { commissions, getCommission } = useVenteCommissions(ventesForCommission);

  useEffect(() => {
    if (user && id) {
      fetchRegieData();
    }
  }, [user, id]);

  const fetchRegieData = async () => {
    if (!user || !id) return;
    setLoading(true);

    try {
      // Fetch regie info
      const { data: regieData, error: regieError } = await supabase
        .from("regies")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (regieError) throw regieError;
      setRegie(regieData);

      // Calculate stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch detailed data for dialogs
      const [rdvAllResult, rdvMoisResult, ventesResult, ventesMoisResult] = await Promise.all([
        supabase
          .from("rdv")
          .select("id, date_heure, status, client_id, clients(nom, prenom)")
          .eq("regie_id", id)
          .order("date_heure", { ascending: false }),
        supabase
          .from("rdv")
          .select("id, date_heure, status, client_id, clients(nom, prenom)")
          .eq("regie_id", id)
          .gte("date_heure", startOfMonth)
          .order("date_heure", { ascending: false }),
        supabase
          .from("ventes")
          .select("id, montant_ht, montant_ttc, puissance_kwc, status, regie_id, etude_id, decom_montant, type_vente, date_signature, commission_override, clients(nom, prenom)")
          .eq("regie_id", id)
          .order("date_signature", { ascending: false }),
        supabase
          .from("ventes")
          .select("id, montant_ttc, status, date_signature, clients(nom, prenom)")
          .eq("regie_id", id)
          .gte("date_signature", startOfMonth.split("T")[0])
          .order("date_signature", { ascending: false }),
      ]);

      const rdvAll = rdvAllResult.data || [];
      const rdvMoisData = rdvMoisResult.data || [];
      const ventes = ventesResult.data || [];
      const ventesMoisData = ventesMoisResult.data || [];

      // Store detailed RDV data
      setAllRdvs(rdvAll.map(r => ({
        id: r.id,
        date_heure: r.date_heure,
        status: r.status,
        client_id: r.client_id,
        client_nom: (r.clients as any)?.nom || "N/A",
        client_prenom: (r.clients as any)?.prenom || null,
      })));

      setRdvsMois(rdvMoisData.map(r => ({
        id: r.id,
        date_heure: r.date_heure,
        status: r.status,
        client_id: r.client_id,
        client_nom: (r.clients as any)?.nom || "N/A",
        client_prenom: (r.clients as any)?.prenom || null,
      })));

      // Store detailed ventes data
      setAllVentes(ventes.map(v => ({
        id: v.id,
        montant_ttc: v.montant_ttc,
        status: v.status,
        date_signature: v.date_signature,
        client_nom: (v.clients as any)?.nom || "N/A",
        client_prenom: (v.clients as any)?.prenom || null,
      })));

      setVentesMoisDetail(ventesMoisData.map(v => ({
        id: v.id,
        montant_ttc: v.montant_ttc,
        status: v.status,
        date_signature: v.date_signature,
        client_nom: (v.clients as any)?.nom || "N/A",
        client_prenom: (v.clients as any)?.prenom || null,
      })));

      // Store ventes for commission calculation (exclude annulées)
      setVentesForCommission(ventes.filter(v => !isCancellationStatus(v.status)).map(v => ({
        id: v.id,
        montant_ht: v.montant_ht,
        montant_ttc: v.montant_ttc,
        puissance_kwc: v.puissance_kwc,
        decom_montant: v.decom_montant,
        type_vente: v.type_vente || 'standard',
        regie_id: v.regie_id,
        etude_id: v.etude_id,
        status: v.status,
      })));

      // Count by status
      const signes = ventes.filter(v => 
        ["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(v.status)
      ).length;
      const poses = ventes.filter(v => 
        ["en_installation", "envoi_pose", "installe", "attente_paiement"].includes(v.status)
      ).length;
      const payes = ventes.filter(v => v.status === "paye").length;
      const annules = ventes.filter(v => isCancellationStatus(v.status)).length;

      const ventesActives = ventes.filter(v => !isCancellationStatus(v.status));
      const caTotal = ventesActives.reduce((sum, v) => sum + (v.montant_ttc || 0), 0);
      const caMois = ventesMoisData.reduce((sum, v) => sum + (v.montant_ttc || 0), 0);

      // Conversion rate: ventes / rdv
      const rdvTotal = rdvAll.length;
      const rdvMois = rdvMoisData.length;
      const tauxConversion = rdvTotal > 0 ? Math.round((ventesActives.length / rdvTotal) * 100) : 0;
      const panierMoyen = ventesActives.length > 0 ? caTotal / ventesActives.length : 0;

      setStats({
        rdvTotal,
        ventesTotal: ventesActives.length,
        caTotal,
        rdvMois,
        ventesMois: ventesMoisData.length,
        caMois,
        signes,
        poses,
        payes,
        annules,
        tauxConversion,
        panierMoyen,
      });
    } catch (error) {
      console.error("Error fetching regie data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate commission totals by category
  const commissionStats = useMemo(() => {
    let enAttente = 0; // signé, attente_financement, cq_a_faire, cq_fait
    let aVenir = 0;    // envoi_pose, en_installation
    let duSur = 0;     // installe, attente_paiement
    let payees = 0;    // paye

    ventesForCommission.forEach(vente => {
      if (isCancellationStatus(vente.status)) return;
      
      const comm = getCommission(vente.id);
      if (!comm) return;

      const net = comm.commissionNette;

      if (["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(vente.status)) {
        enAttente += net;
      } else if (["envoi_pose", "en_installation"].includes(vente.status)) {
        aVenir += net;
      } else if (["installe", "attente_paiement"].includes(vente.status)) {
        duSur += net;
      } else if (vente.status === "paye") {
        payees += net;
      }
    });

    return { enAttente, aVenir, duSur, payees, potentielTotal: enAttente + aVenir + duSur };
  }, [ventesForCommission, commissions, getCommission]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper to get status label
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      nouveau: "Nouveau",
      confirme: "Confirmé",
      reporte: "Reporté",
      positif: "Positif",
      negatif: "Négatif",
      r2: "R2",
      r2_prestudy: "R2 Pré-étude",
      attente: "En attente",
      signe: "Signé",
      attente_financement: "Attente financement",
      cq_a_faire: "CQ à faire",
      cq_fait: "CQ fait",
      envoi_pose: "Envoi pose",
      en_installation: "Installation",
      installe: "Installé",
      attente_paiement: "Attente paiement",
      paye: "Payé",
      annule: "Annulé",
    };
    return labels[status] || status;
  };

  // Generate dialog items based on dialog type
  const getDialogItems = (): StatDetailItem[] => {
    const formatRdvItem = (rdv: RdvDetail): StatDetailItem => ({
      id: rdv.id,
      label: `${rdv.client_prenom || ""} ${rdv.client_nom}`.trim(),
      date: rdv.date_heure,
      status: getStatusLabel(rdv.status),
      navigateTo: `/clients/${rdv.client_id}`,
    });

    const formatVenteItem = (vente: VenteDetail): StatDetailItem => ({
      id: vente.id,
      label: `${vente.client_prenom || ""} ${vente.client_nom}`.trim(),
      value: vente.montant_ttc,
      date: vente.date_signature || undefined,
      status: getStatusLabel(vente.status),
      navigateTo: `/ventes/${vente.id}`,
    });

    const formatVenteWithCommission = (vente: VenteDetail): StatDetailItem => {
      const comm = getCommission(vente.id);
      return {
        id: vente.id,
        label: `${vente.client_prenom || ""} ${vente.client_nom}`.trim(),
        value: comm?.commissionNette || 0,
        date: vente.date_signature || undefined,
        status: getStatusLabel(vente.status),
        navigateTo: `/ventes/${vente.id}`,
      };
    };

    switch (openDialog) {
      case "rdvTotal":
        return allRdvs.map(formatRdvItem);
      case "rdvMois":
        return rdvsMois.map(formatRdvItem);
      case "ventesTotal":
        return allVentes.filter(v => v.status !== "annule").map(formatVenteItem);
      case "ventesMois":
        return ventesMoisDetail.map(formatVenteItem);
      case "caTotal":
        return allVentes.filter(v => v.status !== "annule").map(formatVenteItem);
      case "caMois":
        return ventesMoisDetail.map(formatVenteItem);
      case "signes":
        return allVentes
          .filter(v => ["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(v.status))
          .map(formatVenteItem);
      case "poses":
        return allVentes
          .filter(v => ["en_installation", "envoi_pose", "installe", "attente_paiement"].includes(v.status))
          .map(formatVenteItem);
      case "payes":
        return allVentes.filter(v => v.status === "paye").map(formatVenteItem);
      case "annules":
        return allVentes.filter(v => isCancellationStatus(v.status)).map(formatVenteItem);
      case "commEnAttente":
        return allVentes
          .filter(v => ["signe", "attente_financement", "cq_a_faire", "cq_fait"].includes(v.status))
          .map(formatVenteWithCommission);
      case "commAVenir":
        return allVentes
          .filter(v => ["envoi_pose", "en_installation"].includes(v.status))
          .map(formatVenteWithCommission);
      case "commDuSur":
        return allVentes
          .filter(v => ["installe", "attente_paiement"].includes(v.status))
          .map(formatVenteWithCommission);
      case "commPayees":
        return allVentes.filter(v => v.status === "paye").map(formatVenteWithCommission);
      default:
        return [];
    }
  };

  const getDialogConfig = () => {
    const configs: Record<string, { title: string; subtitle?: string; total?: number; showValue?: boolean }> = {
      rdvTotal: { title: "Tous les RDV", subtitle: `${stats?.rdvTotal || 0} RDV au total` },
      rdvMois: { title: "RDV ce mois", subtitle: `${stats?.rdvMois || 0} RDV` },
      ventesTotal: { title: "Toutes les ventes", total: stats?.caTotal, showValue: true },
      ventesMois: { title: "Ventes ce mois", total: stats?.caMois, showValue: true },
      caTotal: { title: "CA Total", total: stats?.caTotal, showValue: true },
      caMois: { title: "CA ce mois", total: stats?.caMois, showValue: true },
      signes: { title: "Ventes signées", subtitle: `${stats?.signes || 0} ventes` },
      poses: { title: "Ventes posées", subtitle: `${stats?.poses || 0} ventes` },
      payes: { title: "Ventes payées", subtitle: `${stats?.payes || 0} ventes` },
      annules: { title: "Ventes annulées", subtitle: `${stats?.annules || 0} ventes` },
      commEnAttente: { title: "Commissions en attente", total: commissionStats.enAttente, showValue: true },
      commAVenir: { title: "Commissions à venir", total: commissionStats.aVenir, showValue: true },
      commDuSur: { title: "Commissions acquises", total: commissionStats.duSur, showValue: true },
      commPayees: { title: "Commissions payées", total: commissionStats.payees, showValue: true },
    };
    return configs[openDialog || ""] || { title: "" };
  };

  if (loading) {
    return (
      <MobileLayout title="Dashboard Régie" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!regie || !stats) {
    return (
      <MobileLayout title="Dashboard Régie" showBackButton>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Régie non trouvée</p>
        </div>
      </MobileLayout>
    );
  }

  const pipelineTotal = stats.signes + stats.poses + stats.payes;

  return (
    <MobileLayout title={regie.nom} showBackButton>
      <div className="p-4 pb-8 space-y-4">
        {/* Header avec couleur */}
        <div 
          className="rounded-lg p-4 text-white"
          style={{ backgroundColor: regie.couleur }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{regie.nom}</h1>
              <p className="text-white/80 text-sm">Tableau de bord dédié</p>
            </div>
            <Badge variant={regie.actif ? "default" : "secondary"} className="bg-white/20 text-white border-0">
              {regie.actif ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* KPIs principaux */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setOpenDialog("rdvTotal")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-muted-foreground">RDV Total</p>
              </div>
              <p className="text-2xl font-bold">{stats.rdvTotal}</p>
              <p 
                className="text-xs text-muted-foreground mt-1 hover:underline"
                onClick={(e) => { e.stopPropagation(); setOpenDialog("rdvMois"); }}
              >
                Ce mois: <span className="font-medium text-foreground">{stats.rdvMois}</span>
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setOpenDialog("ventesTotal")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                <p className="text-xs text-muted-foreground">Ventes</p>
              </div>
              <p className="text-2xl font-bold">{stats.ventesTotal}</p>
              <p 
                className="text-xs text-muted-foreground mt-1 hover:underline"
                onClick={(e) => { e.stopPropagation(); setOpenDialog("ventesMois"); }}
              >
                Ce mois: <span className="font-medium text-foreground">{stats.ventesMois}</span>
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setOpenDialog("caTotal")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Euro className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">CA Total</p>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.caTotal)}</p>
              <p 
                className="text-xs text-muted-foreground mt-1 hover:underline"
                onClick={(e) => { e.stopPropagation(); setOpenDialog("caMois"); }}
              >
                Ce mois: <span className="font-medium text-foreground">{formatCurrency(stats.caMois)}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-muted-foreground">Conversion</p>
              </div>
              <p className="text-2xl font-bold">{stats.tauxConversion}%</p>
              <p className="text-xs text-muted-foreground mt-1">RDV → Vente</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline des ventes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Pipeline des ventes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Signé → Posé → Payé */}
            <div className="space-y-3">
              <div 
                className="space-y-1 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setOpenDialog("signes")}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600 font-medium">Signées</span>
                  <span>{stats.signes}</span>
                </div>
                <Progress 
                  value={pipelineTotal > 0 ? (stats.signes / pipelineTotal) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div 
                className="space-y-1 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setOpenDialog("poses")}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 font-medium">Posées</span>
                  <span>{stats.poses}</span>
                </div>
                <Progress 
                  value={pipelineTotal > 0 ? (stats.poses / pipelineTotal) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div 
                className="space-y-1 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setOpenDialog("payes")}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">Payées</span>
                  <span>{stats.payes}</span>
                </div>
                <Progress 
                  value={pipelineTotal > 0 ? (stats.payes / pipelineTotal) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </div>

            {/* Annulées */}
            {stats.annules > 0 && (
              <div 
                className="pt-2 border-t cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setOpenDialog("annules")}
              >
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Annulées</span>
                  <span className="text-red-500">{stats.annules}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suivi des Commissions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Suivi des Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Commission categories */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                onClick={() => setOpenDialog("commEnAttente")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">En attente</span>
                </div>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(commissionStats.enAttente)}</p>
              </div>

              <div 
                className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                onClick={() => setOpenDialog("commAVenir")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">À venir</span>
                </div>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(commissionStats.aVenir)}</p>
              </div>

              <div 
                className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                onClick={() => setOpenDialog("commDuSur")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Du Sûr</span>
                </div>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(commissionStats.duSur)}</p>
              </div>

              <div 
                className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                onClick={() => setOpenDialog("commPayees")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Euro className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Payées</span>
                </div>
                <p className="text-lg font-bold text-green-700">{formatCurrency(commissionStats.payees)}</p>
              </div>
            </div>

            {/* Progress bar for potential */}
            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Potentiel total</span>
                <span className="font-bold text-primary">{formatCurrency(commissionStats.potentielTotal)}</span>
              </div>
              <Progress 
                value={commissionStats.potentielTotal > 0 
                  ? (commissionStats.duSur / commissionStats.potentielTotal) * 100 
                  : 0} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground text-center">
                {commissionStats.potentielTotal > 0 
                  ? Math.round((commissionStats.duSur / commissionStats.potentielTotal) * 100)
                  : 0}% acquis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Indicateurs complémentaires */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Indicateurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Panier moyen</span>
              <span className="font-bold">{formatCurrency(stats.panierMoyen)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Taux de signature</span>
              <Badge variant="secondary">
                {stats.rdvTotal > 0 ? Math.round((stats.ventesTotal / stats.rdvTotal) * 100) : 0}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Taux de paiement</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {stats.ventesTotal > 0 ? Math.round((stats.payes / stats.ventesTotal) * 100) : 0}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => navigate(`/crm?regie=${regie.id}`)}
          >
            <Users className="h-4 w-4" />
            Voir les ventes
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => navigate("/parametres/regies")}
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
        </div>
      </div>

      {/* Dialog for stat details */}
      <StatDetailDialog
        open={openDialog !== null}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title={getDialogConfig().title}
        subtitle={getDialogConfig().subtitle}
        items={getDialogItems()}
        total={getDialogConfig().total}
        emptyMessage="Aucun élément"
        formatValue={formatCurrency}
      />
    </MobileLayout>
  );
};

export default RegieDashboard;
