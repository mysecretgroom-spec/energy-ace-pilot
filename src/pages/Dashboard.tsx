import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useVenteCommissions } from "@/hooks/useVenteCommissions";
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
  Hotel
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";

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
  type_projet: string;
  status: string;
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
}

const Dashboard = () => {
  const { user } = useAuth();
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

  // Use commission hook for accurate calculations
  const { getCommission } = useVenteCommissions(ventesForCommission);

  // Calculate commission stats from hook results
  const commissionData = useMemo(() => {
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let commissionsMois = 0;
    let commissionsEnAttente = 0;

    ventesForCommission.forEach(vente => {
      // Skip cancelled sales
      if (vente.status === "annule") return;
      
      const comm = getCommission(vente.id);
      if (!comm) return;

      const net = comm.commission_nette;

      // Commissions du mois (ventes signées ce mois)
      if (vente.date_signature && new Date(vente.date_signature) >= debutMois) {
        commissionsMois += net;
      }

      // Commissions en attente (non payées)
      if (vente.status !== "paye") {
        commissionsEnAttente += net;
      }
    });

    return { commissionsMois, commissionsEnAttente };
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
        // Ventes du mois et année
        supabase.from("ventes").select("id, montant_ht, montant_ttc, puissance_kwc, status, regie_id, etude_id, decom_montant, type_vente, date_signature").eq("user_id", user.id),
        // RDV
        supabase.from("rdv").select("*").eq("user_id", user.id),
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
          .select("id, date_heure, type_projet, status, clients(nom)")
          .eq("user_id", user.id)
          .gte("date_heure", now.toISOString())
          .order("date_heure", { ascending: true })
          .limit(3),
        // Premier RDV de demain pour recherche hôtel
        supabase.from("rdv")
          .select("id, date_heure, clients(ville)")
          .eq("user_id", user.id)
          .gte("date_heure", debutDemain)
          .lte("date_heure", finDemain)
          .order("date_heure", { ascending: true })
          .limit(1)
      ]);

      // Process ventes
      const ventes = ventesRes.data || [];
      
      // Store ventes for commission calculation (exclude annulées)
      setVentesForCommission(ventes.filter(v => v.status !== 'annule').map(v => ({
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
      })));
      
      const ventesMois = ventes.filter(v => 
        v.date_signature && 
        new Date(v.date_signature) >= new Date(debutMois) &&
        new Date(v.date_signature) <= new Date(finMois) &&
        v.status !== 'annule'
      );
      const ventesAnnee = ventes.filter(v => 
        v.date_signature && 
        new Date(v.date_signature) >= new Date(debutAnnee) &&
        new Date(v.date_signature) <= new Date(finAnnee) &&
        v.status !== 'annule'
      );
      const ventesEnCours = ventes.filter(v => 
        v.status === 'en_negociation' || v.status === 'signe' || v.status === 'en_installation'
      );

      // Process RDV
      const rdvs = rdvRes.data || [];
      const rdvAujourd = rdvs.filter(r => r.date_heure?.startsWith(aujourd)).length;
      const rdvSemaine = rdvs.filter(r => 
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
        type_projet: r.type_projet,
        status: r.status
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'nouveau': return <Clock className="h-3 w-3 text-blue-500" />;
      case 'confirme': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'annule': return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

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
      <div className="p-4 space-y-4 pb-24">
        {/* Header avec salutation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bonjour 👋</h1>
            <p className="text-sm text-muted-foreground">
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

        {/* KPIs principaux */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
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

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
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

          <Card>
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

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Commissions</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(commissionData.commissionsMois)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(commissionData.commissionsEnAttente)} en attente
              </p>
            </CardContent>
          </Card>
        </div>

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
                <div 
                  key={rdv.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/planning`)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(rdv.status)}
                    <div>
                      <p className="font-medium text-sm">{rdv.client_nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(rdv.date_heure), "EEEE d MMM à HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {rdv.type_projet}
                  </Badge>
                </div>
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
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{stats.ventesEnCours}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <p className="text-lg font-bold text-green-600">{stats.ventesSignesMois}</p>
                <p className="text-xs text-muted-foreground">Signées</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg">
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
    </MobileLayout>
  );
};

export default Dashboard;
