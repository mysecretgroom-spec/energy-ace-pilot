import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  UserPlus,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Bell
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, differenceInDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import PendingDocumentsWidget from "@/components/admin/PendingDocumentsWidget";

interface AccessState {
  user_id: string;
  app_access: string;
  trial_ends_at: string;
  trial_started_at: string;
}

interface Subscription {
  status: string;
}

interface SaasUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      const { data: subscriptions } = await supabase.rpc("get_all_saas_subscriptions");
      const { data: users } = await supabase.rpc("get_saas_users");

      const accessCounts = {
        trial: 0,
        active: 0,
        paywall: 0,
        blocked: 0,
      };

      const subCounts = {
        active: 0,
        past_due: 0,
        canceled: 0,
      };

      const now = new Date();
      let trialEndingSoon = 0;
      let newThisWeek = 0;
      let newThisMonth = 0;

      ((accessStates as AccessState[]) || []).forEach((state) => {
        if (accessCounts[state.app_access as keyof typeof accessCounts] !== undefined) {
          accessCounts[state.app_access as keyof typeof accessCounts]++;
        }
        
        // Trials ending in 3 days
        if (state.app_access === "trial" && state.trial_ends_at) {
          const daysLeft = differenceInDays(new Date(state.trial_ends_at), now);
          if (daysLeft >= 0 && daysLeft <= 3) {
            trialEndingSoon++;
          }
        }
      });

      ((users as SaasUser[]) || []).forEach((user) => {
        const createdAt = new Date(user.created_at);
        if (differenceInDays(now, createdAt) <= 7) {
          newThisWeek++;
        }
        if (createdAt >= startOfMonth(now) && createdAt <= endOfMonth(now)) {
          newThisMonth++;
        }
      });

      ((subscriptions as Subscription[]) || []).forEach((sub) => {
        if (sub.status === "active") subCounts.active++;
        if (sub.status === "past_due") subCounts.past_due++;
        if (sub.status === "canceled") subCounts.canceled++;
      });

      return {
        totalUsers: ((accessStates as any[]) || []).length,
        accessCounts,
        subCounts,
        trialEndingSoon,
        newThisWeek,
        newThisMonth,
      };
    },
  });

  // Recent users
  const { data: recentUsers } = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: async () => {
      const { data: users } = await supabase.rpc("get_saas_users");
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      
      const accessMap = new Map((accessStates as AccessState[] || []).map(a => [a.user_id, a]));
      
      return ((users as SaasUser[]) || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(u => ({
          ...u,
          access: accessMap.get(u.user_id),
        }));
    },
  });

  const conversionRate = stats 
    ? (stats.accessCounts.active / (stats.totalUsers || 1) * 100).toFixed(1)
    : "0";

  const churnRate = stats
    ? ((stats.accessCounts.paywall + stats.accessCounts.blocked) / (stats.totalUsers || 1) * 100).toFixed(1)
    : "0";

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Vue d'ensemble de votre SaaS</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/notifications">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Envoyer une notification
              </Button>
            </Link>
          </div>
        </div>

        {/* Main KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +{stats?.newThisMonth || 0} ce mois
              </p>
              <div className="absolute bottom-0 right-0 opacity-10">
                <Users className="h-24 w-24" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats?.accessCounts.active || 0}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {conversionRate}% de conversion
              </p>
              <div className="absolute bottom-0 right-0 opacity-10">
                <CreditCard className="h-24 w-24" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Période d'Essai</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats?.accessCounts.trial || 0}</div>
              {(stats?.trialEndingSoon || 0) > 0 && (
                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats?.trialEndingSoon} expirent sous 3j
                </p>
              )}
              <div className="absolute bottom-0 right-0 opacity-10">
                <Clock className="h-24 w-24" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impayés / Bloqués</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {(stats?.subCounts.past_due || 0) + (stats?.accessCounts.blocked || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.accessCounts.paywall || 0} en paywall
              </p>
              <div className="absolute bottom-0 right-0 opacity-10">
                <AlertTriangle className="h-24 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats + Quick Actions + Pending Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Documents Widget */}
          <PendingDocumentsWidget />
          {/* Funnel Overview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Entonnoir de Conversion
              </CardTitle>
              <CardDescription>Répartition des utilisateurs par statut</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      En Trial
                    </span>
                    <span className="font-medium">{stats?.accessCounts.trial || 0}</span>
                  </div>
                  <Progress value={(stats?.accessCounts.trial || 0) / (stats?.totalUsers || 1) * 100} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-green-500" />
                      Actifs (Payants)
                    </span>
                    <span className="font-medium text-green-600">{stats?.accessCounts.active || 0}</span>
                  </div>
                  <Progress value={(stats?.accessCounts.active || 0) / (stats?.totalUsers || 1) * 100} className="h-2 [&>div]:bg-green-500" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Paywall (Trial expiré)
                    </span>
                    <span className="font-medium text-yellow-600">{stats?.accessCounts.paywall || 0}</span>
                  </div>
                  <Progress value={(stats?.accessCounts.paywall || 0) / (stats?.totalUsers || 1) * 100} className="h-2 [&>div]:bg-yellow-500" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Bloqués
                    </span>
                    <span className="font-medium text-destructive">{stats?.accessCounts.blocked || 0}</span>
                  </div>
                  <Progress value={(stats?.accessCounts.blocked || 0) / (stats?.totalUsers || 1) * 100} className="h-2 [&>div]:bg-destructive" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Taux de Conversion</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{churnRate}%</p>
                  <p className="text-xs text-muted-foreground">Taux de Churn</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/admin/clients" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Gérer les clients
                  <ArrowUpRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              
              {(stats?.trialEndingSoon || 0) > 0 && (
                <Link to="/admin/clients" className="block">
                  <Button variant="outline" className="w-full justify-start border-yellow-500/50 text-yellow-600 hover:bg-yellow-50">
                    <Clock className="h-4 w-4 mr-2" />
                    {stats?.trialEndingSoon} trials à relancer
                    <ArrowUpRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              )}

              <Link to="/admin/notifications" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Bell className="h-4 w-4 mr-2" />
                  Envoyer une notification
                  <ArrowUpRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>

              <Link to="/admin/analytics" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Voir les analytics
                  <ArrowUpRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>

              <Link to="/admin/support" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  Tickets support
                  <ArrowUpRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Dernières Inscriptions
              </CardTitle>
              <CardDescription>Les 5 derniers utilisateurs inscrits</CardDescription>
            </div>
            <Link to="/admin/clients">
              <Button variant="outline" size="sm">
                Voir tout
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers?.map((user) => (
                <div key={user.user_id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.first_name || user.last_name 
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : user.email.split("@")[0]}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={user.access?.app_access === "active" ? "default" : "secondary"}>
                      {user.access?.app_access || "trial"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(user.created_at), "dd MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stripe Integration Placeholder */}
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">💰 Métriques de revenus (MRR, ARR, LTV)</p>
              <p className="text-sm mt-2">
                Connectez Stripe pour voir les métriques de revenus en temps réel
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}