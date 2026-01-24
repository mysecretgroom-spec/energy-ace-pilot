import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, Clock, AlertTriangle } from "lucide-react";

interface AccessState {
  user_id: string;
  app_access: string;
}

interface Subscription {
  status: string;
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Get all access states using RPC
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states" as any);

      // Get all subscriptions using RPC
      const { data: subscriptions } = await supabase.rpc("get_all_saas_subscriptions" as any);

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

      (accessStates as AccessState[] | null)?.forEach((state) => {
        if (accessCounts[state.app_access as keyof typeof accessCounts] !== undefined) {
          accessCounts[state.app_access as keyof typeof accessCounts]++;
        }
      });

      (subscriptions as Subscription[] | null)?.forEach((sub) => {
        if (sub.status === "active") subCounts.active++;
        if (sub.status === "past_due") subCounts.past_due++;
        if (sub.status === "canceled") subCounts.canceled++;
      });

      return {
        totalUsers: (accessStates as any[] | null)?.length || 0,
        accessCounts,
        subCounts,
      };
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de votre SaaS</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Trial</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.accessCounts.trial || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnés Actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.subCounts.active || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impayés</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.subCounts.past_due || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Statut d'Accès</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Trial</span>
                  <span className="font-bold">{stats?.accessCounts.trial || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Actif</span>
                  <span className="font-bold text-green-600">{stats?.accessCounts.active || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Paywall</span>
                  <span className="font-bold text-yellow-600">{stats?.accessCounts.paywall || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Bloqué</span>
                  <span className="font-bold text-red-600">{stats?.accessCounts.blocked || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abonnements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Actifs</span>
                  <span className="font-bold text-green-600">{stats?.subCounts.active || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Impayés</span>
                  <span className="font-bold text-yellow-600">{stats?.subCounts.past_due || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Annulés</span>
                  <span className="font-bold text-red-600">{stats?.subCounts.canceled || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
