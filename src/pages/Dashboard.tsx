import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BlurOverlay } from "@/components/layout/BlurOverlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { supabase } from "@/integrations/supabase/client";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
import { StatDetailDialog, StatDetailItem } from "@/components/stats/StatDetailDialog";

import {
  TrendingUp, 
  Calendar, 
  Users, 
  Euro, 
  Target,
  ArrowRight,
  FileText,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hotel,
  Flame
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { DashboardRdvCard } from "@/components/dashboard/DashboardRdvCard";

interface DashboardStats {
  // Ventes
  ventesSignesMois: number;
  caMois: number;
  caAnnee: number;
  ventesEnCours: number;
  
  // RDV
  rdvAujourd: number;
  rdvSemaine: number;
  rdvTotal: number;
  
  // Clients
  nouveauxClientsMois: number;
  totalClients: number;
  
  // Commissions
  commissionsMois: number;
  commissionsEnAttente: number;
  
  // Objectifs
  objectifCA: number;
  objectifVentes: number;
  objectifRdv: number;
}

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lue: boolean;
  created_at: string;
}

interface ProchainRdv {
  id: string;
  date_heure: string;
  client_nom: string;
  client_prenom?: string;
  client_id: string;
  type_projet: string;
  status: string;
  type_rdv: "standard" | "external_installation";
  etude_id?: string | null;
  regie_id?: string | null;
  regie_nom?: string | null;
  regie_couleur?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
}

interface RdvDemain {
  id: string;
  date_heure: string;
  ville: string | null;
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
  date_signature: string | null;
  is_retape: boolean;
  client_nom?: string;
  client_prenom?: string;
  client_id?: string;
}

interface RawRdv {
  id: string;
  date_heure: string;
  status: string;
  type_projet: string | null;
  client_nom?: string;
  client_id?: string;
}

type StatDialogType = 'ca' | 'ventes' | 'rdv' | 'commissions' | 'commissionsAttente' | 'hejja' | 'ventesEnCours' | 'caAnnee' | null;

const Dashboard = () => {
  const { user } = useAuth();
  const { isActive: modeHejjaActive } = useHejjaMode();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    ventesSignesMois: 0,
    caMois: 0,
    caAnnee: 0,
    ventesEnCours: 0,
    rdvAujourd: 0,
    rdvSemaine: 0,
    rdvTotal: 0,
    nouveauxClientsMois: 0,
    totalClients: 0,
    commissionsMois: 0,
    commissionsEnAttente: 0,
    objectifCA: 50000,
    objectifVentes: 10,
    objectifRdv: 30
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prochainsRdv, setProchainsRdv] = useState<ProchainRdv[]>([]);
  const [premierRdvDemain, setPremierRdvDemain] = useState<RdvDemain | null>(null);
  const [loading, setLoading] = useState(true);
  const [ventesForCommission, setVentesForCommission] = useState<VenteForCommission[]>([]);
  const [rawRdvs, setRawRdvs] = useState<RawRdv[]>([]);
  
  // Dialog state
  const [statDialogOpen, setStatDialogOpen] = useState(false);
  const [statDialogType, setStatDialogType] = useState<StatDialogType>(null);

  // Use commission hook for accurate calculations
  const { getCommission } = useVenteCommissions(ventesForCommission);

  // Calculate commission stats from hook results
  const commissionData = useMemo(() => {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let commissionsMois = 0;
    let commissionsEnAttente = 0;
    let commissionsHejja = 0;

    ventesForCommission.forEach(vente => {
      // Skip cancelled sales
      if (vente.status === "annulo") return;
      
      const comm = getCommission(vente.id);
      if (!comm) return;

      const net = comm.commissionNette;

      // Commissions HEJJA (retape sales)
      if (vente.is_retape) {
        commissionsHejja += net;
        return; // Don't count in regular stats
      }

      // Commissions du mois (ventes signées ce mois)
      if (vente.date_signature && new Date(vente.date_signature) >= debutMois) {
        commissionsMois += net;
      }

      // Commissions en attente (non payées)
      if (vente.status !== "paye") {
        commissionsEnAttente += net;
      }
    });

    return { commissionsMois, commissionsEnAttente, commissionsHejja };
  }, [ventesForCommission, getCommission]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const debutMois = startOfMonth(now).toISOString();
    const finMois = endOfMonth(now).toISOString();
    const debutAnnee = startOfYear(now).toISOString();
    const finAnnee = endOfYear(now).toISOString();
    const aujourd = format(now, "yyyy-MM-dd");
    const finSemaine = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Calculer demain pour la recherche d'hôtel
    const demain = new Date(now);
    demain.setDate(demain.getDate() + 1);
    const debutDemain = new Date(demain.setHours(0, 0, 0, 0)).toISOString();
    const finDemain = new Date(demain.setHours(23, 59, 59, 999)).toISOString();

    try {
      // Fetch all data in parallel
      const [
        ventesRes,
        rdvRes,
        clientsRes,
        commissionsRes,
        objectifsRes,
        notificationsRes,
        prochainsRdvRes,
        rdvDemainRes
      ] = await Promise.all([
        // Ventes du mois et année - include client info
        supabase.from("ventes").select("id, montant_ht, montant_ttc, puissance_kwc, status, regie_id, etude_id, decom_montant, type_vente, date_signature, is_retape, client_id, clients(nom, prenom)").eq("user_id", user.id),
        // RDV with client info
        supabase.from("rdv").select("id, date_heure, status, type_projet, client_id, clients(nom, prenom)").eq("user_id", user.id),
        // Clients
        supabase.from("clients").select("id, created_at").eq("user_id", user.id),
        // Placeholder for removed commissions query
        Promise.resolve({ data: [] }),
        // Objectifs du mois
        supabase.from("objectifs")
          .select("*")
          .eq("user_id", user.id)
          .eq("mois", now.getMonth() + 1)
          .eq("annee", now.getFullYear())
          .maybeSingle(),
        // Notifications non lues
        supabase.from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("lue", false)
          .order("created_at", { ascending: false })
          .limit(5),
        // Prochains RDV
        supabase.from("rdv")
          .select(`
            id, date_heure, type_projet, status, type_rdv, etude_id, regie_id,
            clients(id, nom, prenom, telephone, adresse, code_postal, ville),
            regies(nom, couleur)
          `)
          .eq("user_id", user.id)
          .gte("date_heure", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
          .not("status", "eq", "annule")
          .order("date_heure", { ascending: true })
          .limit(5),
        // Premier RDV de demain pour recherche hôtel (exclure annulés)
        supabase.from("rdv")
          .select("id, date_heure, clients(ville)")
          .eq("user_id", user.id)
          .gte("date_heure", debutDemain)
          .lte("date_heure", finDemain)
          .not("status", "eq", "annule")
          .order("date_heure", { ascending: true })
          .limit(1)
      ]);

      // Process ventes
      const ventes = ventesRes.data || [];
      
      // Store ventes for commission calculation (exclude annulées)
      setVentesForCommission(ventes.filter(v => v.status !== 'annule').map((v: any) => ({
        id: v.id,
        montant_ht: v.montant_ht,
        montant_ttc: v.montant_ttc,
        puissance_kwc: v.puissance_kwc,
        decom_montant: v.decom_montant,
        type_vente: v.type_vente || 'standard',
        regie_id: v.regie_id,
        etude_id: v.etude_id,
        status: v.status,
        date_signature: v.date_signature,
        is_retape: v.is_retape || false,
        client_nom: v.clients?.nom || "Client",
        client_prenom: v.clients?.prenom || "",
        client_id: v.client_id,
      })));
      
      const ventesMois = ventes.filter((v: any) => 
        v.date_signature && 
        new Date(v.date_signature) >= new Date(debutMois) &&
        new Date(v.date_signature) <= new Date(finMois) &&
        v.status !== 'annule' &&
        v.type_vente !== 'external_installation' // Exclure les installations externes du CA
      );
      const ventesAnnee = ventes.filter((v: any) => 
        v.date_signature && 
        new Date(v.date_signature) >= new Date(debutAnnee) &&
        new Date(v.date_signature) <= new Date(finAnnee) &&
        v.status !== 'annule' &&
        v.type_vente !== 'external_installation' // Exclure les installations externes du CA
      );
      // Ventes en cours = signées mais pas encore posées (signe -> envoi_pose)
      const enCoursStatuses = ['signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose'];
      const ventesEnCours = ventes.filter((v: any) => 
        enCoursStatuses.includes(v.status) && v.status !== 'annule'
      );

      // Process RDV
      const rdvs = rdvRes.data || [];
      
      // Store raw RDVs for dialog
      setRawRdvs(rdvs.map((r: any) => ({
        id: r.id,
        date_heure: r.date_heure,
        status: r.status,
        type_projet: r.type_projet,
        client_nom: r.clients?.nom || "Client",
        client_id: r.client_id,
      })));
      
      const rdvAujourd = rdvs.filter((r: any) => r.date_heure?.startsWith(aujourd)).length;
      const rdvSemaine = rdvs.filter((r: any) => 
        new Date(r.date_heure) >= now && 
        new Date(r.date_heure) <= new Date(finSemaine)
      ).length;

      // Process clients
      const clients = clientsRes.data || [];
      const nouveauxClientsMois = clients.filter(c => 
        new Date(c.created_at) >= new Date(debutMois)
      ).length;

      // Objectifs
      const objectifs = objectifsRes.data;

      setStats({
        ventesSignesMois: ventesMois.length,
        caMois: ventesMois.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0),
        caAnnee: ventesAnnee.reduce((sum, v) => sum + Number(v.montant_ttc || 0), 0),
        ventesEnCours: ventesEnCours.length,
        rdvAujourd,
        rdvSemaine,
        rdvTotal: rdvs.length,
        nouveauxClientsMois,
        totalClients: clients.length,
        commissionsMois: 0, // Will be calculated by hook
        commissionsEnAttente: 0, // Will be calculated by hook
        objectifCA: objectifs?.objectif_ca || 50000,
        objectifVentes: objectifs?.objectif_ventes || 10,
        objectifRdv: objectifs?.objectif_rdv || 30
      });

      setNotifications(notificationsRes.data || []);
      
      // Transform prochains RDV
      setProchainsRdv((prochainsRdvRes.data || []).map((r: any) => ({
        id: r.id,
        date_heure: r.date_heure,
        client_nom: r.clients?.nom || "Client inconnu",
        client_prenom: r.clients?.prenom || "",
        client_id: r.clients?.id || "",
        type_projet: r.type_projet,
        status: r.status,
        type_rdv: r.type_rdv || "standard",
        etude_id: r.etude_id,
        regie_id: r.regie_id,
        regie_nom: r.regies?.nom || null,
        regie_couleur: r.regies?.couleur || null,
        telephone: r.clients?.telephone || null,
        adresse: r.clients?.adresse || null,
        code_postal: r.clients?.code_postal || null,
        ville: r.clients?.ville || null,
      })));

      // Premier RDV de demain pour Booking
      if (rdvDemainRes.data && rdvDemainRes.data.length > 0) {
        const rdv = rdvDemainRes.data[0] as any;
        setPremierRdvDemain({
          id: rdv.id,
          date_heure: rdv.date_heure,
          ville: rdv.clients?.ville || null
        });
      } else {
        setPremierRdvDemain(null);
      }

    } catch (error) {
      console.error("Erreur chargement dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getProgressPercent = (value: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((value / target) * 100, 100);
  };

  // Open stat detail dialog
  const openStatDialog = (type: StatDialogType) => {
    setStatDialogType(type);
    setStatDialogOpen(true);
  };

  // Get dialog items based on type
  const getStatDialogData = useMemo(() => {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const aujourd = format(now, "yyyy-MM-dd");
    
    switch (statDialogType) {
      case 'ca':
      case 'ventes': {
        // Ventes signées ce mois
        const ventesMois = ventesForCommission.filter(v => 
          v.date_signature && 
          new Date(v.date_signature) >= debutMois &&
          !v.is_retape
        );
        return {
          title: statDialogType === 'ca' ? "CA du mois" : "Ventes du mois",
          subtitle: format(now, "MMMM yyyy", { locale: fr }),
          items: ventesMois.map(v => ({
            id: v.id,
            label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
          })),
          total: ventesMois.reduce((sum, v) => sum + v.montant_ttc, 0),
        };
      }
      case 'rdv': {
        // RDV aujourd'hui
        const rdvsAujourd = rawRdvs.filter(r => r.date_heure?.startsWith(aujourd));
        return {
          title: "RDV aujourd'hui",
          subtitle: format(now, "EEEE d MMMM", { locale: fr }),
          items: rdvsAujourd.map(r => ({
            id: r.id,
            label: r.client_nom || "Client",
            sublabel: r.type_projet || "RDV",
            valueLabel: format(new Date(r.date_heure), "HH:mm"),
            date: r.date_heure,
            status: r.status === 'confirme' ? 'Confirmé' : r.status === 'annule' ? 'Annulé' : 'Nouveau',
            statusColor: r.status === 'confirme' ? '#22c55e' : r.status === 'annule' ? '#ef4444' : '#3b82f6',
            navigateTo: `/planning`,
          })),
          total: undefined,
          formatValue: (v: number) => `${v}`,
        };
      }
      case 'commissions': {
        // Commissions du mois (ventes signées ce mois)
        const ventesMois = ventesForCommission.filter(v => 
          v.date_signature && 
          new Date(v.date_signature) >= debutMois &&
          !v.is_retape
        );
        return {
          title: "Commissions du mois",
          subtitle: format(now, "MMMM yyyy", { locale: fr }),
          items: ventesMois.map(v => {
            const comm = getCommission(v.id);
            return {
              id: v.id,
              label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
              sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
              value: comm?.commissionNette || 0,
              date: v.date_signature || undefined,
              navigateTo: `/ventes/${v.id}`,
            };
          }),
          total: commissionData.commissionsMois,
        };
      }
      case 'commissionsAttente': {
        // Toutes les ventes non payées (sauf retapes)
        const ventesNonPayees = ventesForCommission.filter(v => 
          v.status !== 'paye' && !v.is_retape
        );
        return {
          title: "Commissions en attente",
          subtitle: "Ventes non payées",
          items: ventesNonPayees.map(v => {
            const comm = getCommission(v.id);
            return {
              id: v.id,
              label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
              sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
              value: comm?.commissionNette || 0,
              date: v.date_signature || undefined,
              navigateTo: `/ventes/${v.id}`,
            };
          }),
          total: commissionData.commissionsEnAttente,
        };
      }
      case 'hejja': {
        // Ventes retape
        const ventesRetape = ventesForCommission.filter(v => v.is_retape);
        return {
          title: "Commissions HEJJA",
          subtitle: "Ventes Retape",
          items: ventesRetape.map(v => {
            const comm = getCommission(v.id);
            return {
              id: v.id,
              label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
              sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
              value: comm?.commissionNette || 0,
              date: v.date_signature || undefined,
              navigateTo: `/ventes/${v.id}`,
            };
          }),
          total: commissionData.commissionsHejja,
        };
      }
      case 'ventesEnCours': {
        const enCoursStatuses = ['signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose'];
        const ventesEC = ventesForCommission.filter(v => 
          enCoursStatuses.includes(v.status) && !v.is_retape
        );
        return {
          title: "Ventes en cours",
          subtitle: "Signées, en attente de pose",
          items: ventesEC.map(v => ({
            id: v.id,
            label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
          })),
          total: ventesEC.reduce((sum, v) => sum + v.montant_ttc, 0),
        };
      }
      case 'caAnnee': {
        const debutAnnee = new Date(now.getFullYear(), 0, 1);
        const ventesAnnee = ventesForCommission.filter(v => 
          v.date_signature && 
          new Date(v.date_signature) >= debutAnnee &&
          !v.is_retape &&
          v.type_vente !== 'external_installation'
        );
        return {
          title: "CA Année",
          subtitle: now.getFullYear().toString(),
          items: ventesAnnee.map(v => ({
            id: v.id,
            label: `${v.client_nom} ${v.client_prenom || ""}`.trim(),
            sublabel: v.puissance_kwc ? `${v.puissance_kwc} kWc` : "Installation externe",
            value: v.montant_ttc,
            date: v.date_signature || undefined,
            navigateTo: `/ventes/${v.id}`,
          })),
          total: ventesAnnee.reduce((sum, v) => sum + v.montant_ttc, 0),
        };
      }
      default:
        return { title: "", items: [], total: undefined };
    }
  }, [statDialogType, ventesForCommission, rawRdvs, getCommission, commissionData]);

  const openBookingSearch = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const checkIn = format(today, "yyyy-MM-dd");
    const checkOut = format(tomorrow, "yyyy-MM-dd");
    
    // Utiliser la ville du premier RDV de demain, sinon ville par défaut
    const destination = premierRdvDemain?.ville || "France";
    
    const bookingUrl = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(destination)}&checkin=${checkIn}&checkout=${checkOut}&no_rooms=1&group_adults=1`;
    
    window.open(bookingUrl, "_blank");
  };

  // Afficher le bouton hôtel si:
  // 1. Il y a un RDV demain
  // 2. OU si on est jeudi après 19h jusqu'à vendredi 10h (pour le week-end)
  const shouldShowHotelButton = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = dimanche, 4 = jeudi, 5 = vendredi
    const hour = now.getHours();
    
    // Condition 1: RDV demain
    if (premierRdvDemain) {
      return true;
    }
    
    // Condition 2: Jeudi après 19h
    if (dayOfWeek === 4 && hour >= 19) {
      return true;
    }
    
    // Condition 3: Vendredi avant 10h
    if (dayOfWeek === 5 && hour < 10) {
      return true;
    }
    
    return false;
  };

  return (
    <MobileLayout title="Dashboard" showBackButton={false}>
      <div className="p-4 space-y-4 pb-24 max-w-4xl mx-auto">
        {/* Header avec salutation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Bonjour</h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE d MMMM", { locale: fr })}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="relative"
            onClick={() => navigate("/notifications")}
          >
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </Button>
        </div>

        {/* KPIs principaux - avec floutage opaque */}
        <BlurOverlay storageKey="dashboard_stats" blurAmount={12} opaque>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card 
            className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openStatDialog('ca')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Euro className="h-4 w-4" />
                <span className="text-xs font-medium">CA Mois</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.caMois)}</p>
              <Progress 
                value={getProgressPercent(stats.caMois, stats.objectifCA)} 
                className="h-1.5 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obj: {formatCurrency(stats.objectifCA)}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openStatDialog('ventes')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">Ventes</span>
              </div>
              <p className="text-xl font-bold">{stats.ventesSignesMois}</p>
              <Progress 
                value={getProgressPercent(stats.ventesSignesMois, stats.objectifVentes)} 
                className="h-1.5 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obj: {stats.objectifVentes} ventes
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openStatDialog('rdv')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">RDV Aujourd'hui</span>
              </div>
              <p className="text-xl font-bold">{stats.rdvAujourd}</p>
              <p className="text-xs text-muted-foreground">
                {stats.rdvSemaine} cette semaine
              </p>
            </CardContent>
          </Card>
          {/* Commission card */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openStatDialog('commissions')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Commissions</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(commissionData.commissionsMois)}</p>
              <p 
                className="text-xs text-muted-foreground underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); openStatDialog('commissionsAttente'); }}
              >
                {formatCurrency(commissionData.commissionsEnAttente)} en attente
              </p>
            </CardContent>
          </Card>

          {/* Commission HEJJA - Only visible in HEJJA mode */}
          {modeHejjaActive && (
            <Card 
              className="bg-gradient-to-br from-red-500/20 to-orange-500/10 border-red-500/30 col-span-2 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openStatDialog('hejja')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <Flame className="h-4 w-4" />
                  <span className="text-xs font-medium">Commission HEJJA</span>
                  <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/30 ml-auto">
                    RETAPES
                  </Badge>
                </div>
                <p className="text-xl font-bold text-red-600">{formatCurrency(commissionData.commissionsHejja)}</p>
                <p className="text-xs text-muted-foreground">
                  Total sur ventes retape (masqué hors mode HEJJA)
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        </BlurOverlay>

        {/* Prochains RDV */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Prochains RDV</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/planning")}>
                Voir tout <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {prochainsRdv.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun RDV à venir
              </p>
            ) : (
              prochainsRdv.map((rdv) => (
                <DashboardRdvCard 
                  key={rdv.id}
                  rdv={rdv}
                  onRefresh={fetchDashboardData}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Bouton recherche hôtel Booking - affiché conditionnellement */}
        {shouldShowHotelButton() && (
          <div 
            onClick={openBookingSearch}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003580] via-[#00224F] to-[#001833] p-4 cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            {/* Effet de brillance au survol */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            {/* Étoiles décoratives */}
            <div className="absolute top-2 right-3 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-xs">★</span>
              ))}
            </div>
            
            <div className="relative flex items-center gap-4">
              {/* Icône avec effet glow */}
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Hotel className="h-7 w-7 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base">
                  Trouver un hôtel
                </h3>
                <p className="text-blue-200 text-sm">
                  {premierRdvDemain?.ville 
                    ? `Près de ${premierRdvDemain.ville} pour ce soir`
                    : "Recherche sur Booking.com"
                  }
                </p>
              </div>
              
              {/* Flèche animée */}
              <ArrowRight className="h-5 w-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            
            {/* Badge Booking */}
            <div className="absolute bottom-2 right-3">
              <span className="text-[10px] text-blue-300/60 font-medium tracking-wide">
                via Booking.com
              </span>
            </div>
          </div>
        )}

        {/* Pipeline ventes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline Ventes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/crm")}>
                Gérer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div 
                className="p-3 bg-blue-500/10 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-colors active:scale-[0.97]"
                onClick={() => openStatDialog('ventesEnCours')}
              >
                <p className="text-lg font-bold text-blue-600">{stats.ventesEnCours}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
              <div 
                className="p-3 bg-green-500/10 rounded-lg cursor-pointer hover:bg-green-500/20 transition-colors active:scale-[0.97]"
                onClick={() => openStatDialog('ventes')}
              >
                <p className="text-lg font-bold text-green-600">{stats.ventesSignesMois}</p>
                <p className="text-xs text-muted-foreground">Signées</p>
              </div>
              <div 
                className="p-3 bg-amber-500/10 rounded-lg cursor-pointer hover:bg-amber-500/20 transition-colors active:scale-[0.97]"
                onClick={() => openStatDialog('caAnnee')}
              >
                <p className="text-lg font-bold text-amber-600">{formatCurrency(stats.caAnnee)}</p>
                <p className="text-xs text-muted-foreground">CA Année</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/crm")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.totalClients}</p>
                <p className="text-xs text-muted-foreground">Clients</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/finance")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold">+{stats.nouveauxClientsMois}</p>
                <p className="text-xs text-muted-foreground">Ce mois</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stat Detail Dialog */}
      <StatDetailDialog
        open={statDialogOpen}
        onOpenChange={setStatDialogOpen}
        title={getStatDialogData.title}
        subtitle={getStatDialogData.subtitle}
        items={getStatDialogData.items}
        total={getStatDialogData.total}
        emptyMessage="Aucune donnée"
      />
    </MobileLayout>
  );
};

export default Dashboard;
