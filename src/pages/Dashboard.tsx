import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  AlertCircle
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
  const [loading, setLoading] = useState(true);

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

    try {
      // Fetch all data in parallel
      const [
        ventesRes,
        rdvRes,
        clientsRes,
        commissionsRes,
        objectifsRes,
        notificationsRes,
        prochainsRdvRes
      ] = await Promise.all([
        // Ventes du mois et année
        supabase.from("ventes").select("*").eq("user_id", user.id),
        // RDV
        supabase.from("rdv").select("*").eq("user_id", user.id),
        // Clients
        supabase.from("clients").select("id, created_at").eq("user_id", user.id),
        // Commissions
        supabase.from("commissions").select("*").eq("user_id", user.id),
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
          .limit(3)
      ]);

      // Process ventes
      const ventes = ventesRes.data || [];
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

      // Process commissions
      const commissions = commissionsRes.data || [];
      const commissionsMois = commissions
        .filter(c => new Date(c.date_calcul) >= new Date(debutMois))
        .reduce((sum, c) => sum + Number(c.montant_commission || 0), 0);
      const commissionsEnAttente = commissions
        .filter(c => !c.paye)
        .reduce((sum, c) => sum + Number(c.montant_commission || 0), 0);

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
        commissionsMois,
        commissionsEnAttente,
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
              <p className="text-xl font-bold">{formatCurrency(stats.commissionsMois)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.commissionsEnAttente)} en attente
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

        {/* Pipeline ventes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pipeline Ventes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/ventes")}>
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
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/clients")}>
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
