import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Users, UserPlus, Calendar, Target, Percent, ArrowUp, ArrowDown } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { differenceInDays, format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface AnalyticsData {
  month: string;
  total_users: number;
  trial_users: number;
  active_users: number;
  churned_users: number;
  new_signups: number;
}

interface AccessState {
  user_id: string;
  app_access: string;
  trial_started_at: string;
  trial_ends_at: string;
}

interface SaasUser {
  user_id: string;
  created_at: string;
}

const chartConfig = {
  total_users: { label: "Total", color: "hsl(var(--primary))" },
  active_users: { label: "Actifs", color: "hsl(142 76% 36%)" },
  trial_users: { label: "En trial", color: "hsl(38 92% 50%)" },
  churned_users: { label: "Churned", color: "hsl(0 84% 60%)" },
  new_signups: { label: "Nouveaux", color: "hsl(221 83% 53%)" },
};

const COLORS = ["hsl(142 76% 36%)", "hsl(221 83% 53%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)"];

export default function AdminAnalytics() {
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revenue_analytics");
      if (error) throw error;
      return (data as AnalyticsData[]) || [];
    },
  });

  const { data: cohortData } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: async () => {
      const { data: users } = await supabase.rpc("get_saas_users");
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      
      const accessMap = new Map((accessStates as AccessState[] || []).map(a => [a.user_id, a]));
      
      // Group users by signup month
      const cohorts: Record<string, { total: number; converted: number; churned: number; active: number }> = {};
      
      ((users as SaasUser[]) || []).forEach((user) => {
        const monthKey = format(new Date(user.created_at), "yyyy-MM");
        if (!cohorts[monthKey]) {
          cohorts[monthKey] = { total: 0, converted: 0, churned: 0, active: 0 };
        }
        cohorts[monthKey].total++;
        
        const access = accessMap.get(user.user_id);
        if (access) {
          if (access.app_access === "active") {
            cohorts[monthKey].converted++;
            cohorts[monthKey].active++;
          } else if (access.app_access === "paywall" || access.app_access === "blocked") {
            cohorts[monthKey].churned++;
          } else if (access.app_access === "trial") {
            cohorts[monthKey].active++;
          }
        }
      });

      return Object.entries(cohorts)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({
          month: format(new Date(month + "-01"), "MMM yy", { locale: fr }),
          ...data,
          conversionRate: data.total > 0 ? ((data.converted / data.total) * 100).toFixed(1) : "0",
          retentionRate: data.total > 0 ? ((data.active / data.total) * 100).toFixed(1) : "0",
        }));
    },
  });

  const { data: distributionData } = useQuery({
    queryKey: ["admin-distribution"],
    queryFn: async () => {
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      
      const counts = { active: 0, trial: 0, paywall: 0, blocked: 0 };
      ((accessStates as AccessState[]) || []).forEach((state) => {
        if (counts[state.app_access as keyof typeof counts] !== undefined) {
          counts[state.app_access as keyof typeof counts]++;
        }
      });

      return [
        { name: "Actifs", value: counts.active, color: COLORS[0] },
        { name: "Trial", value: counts.trial, color: COLORS[1] },
        { name: "Paywall", value: counts.paywall, color: COLORS[2] },
        { name: "Bloqués", value: counts.blocked, color: COLORS[3] },
      ];
    },
  });

  // Calculate metrics
  const currentMonth = analytics?.[analytics.length - 1];
  const previousMonth = analytics?.[analytics.length - 2];

  const growthRate = previousMonth && currentMonth
    ? ((currentMonth.total_users - previousMonth.total_users) / (previousMonth.total_users || 1) * 100).toFixed(1)
    : "0";

  const churnRate = currentMonth
    ? ((currentMonth.churned_users / (currentMonth.total_users || 1)) * 100).toFixed(1)
    : "0";

  const conversionRate = currentMonth && currentMonth.trial_users > 0
    ? ((currentMonth.active_users / (currentMonth.trial_users + currentMonth.active_users)) * 100).toFixed(1)
    : "0";

  const avgTrialDays = 15; // Based on trial duration setting

  if (isLoadingAnalytics) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Métriques de croissance, rétention et conversion</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="growth">Croissance</TabsTrigger>
            <TabsTrigger value="cohorts">Cohortes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Utilisateurs Actifs</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.active_users || 0}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {Number(growthRate) >= 0 ? (
                      <>
                        <ArrowUp className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">+{growthRate}%</span>
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3 text-red-500" />
                        <span className="text-red-600">{growthRate}%</span>
                      </>
                    )}
                    <span className="ml-1">vs mois dernier</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nouveaux Inscrits</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentMonth?.new_signups || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Ce mois-ci</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taux de Conversion</CardTitle>
                  <Target className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{conversionRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Trial → Payant</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taux de Churn</CardTitle>
                  <Percent className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{churnRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Utilisateurs perdus</p>
                </CardContent>
              </Card>
            </div>

            {/* Distribution Pie + Evolution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribution des Utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {(distributionData || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {(distributionData || []).map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Évolution des Utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <AreaChart data={analytics || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(value) => {
                          const [year, month] = value.split("-");
                          return `${month}/${year.slice(2)}`;
                        }}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="active_users"
                        stackId="1"
                        stroke="hsl(142 76% 36%)"
                        fill="hsl(142 76% 36% / 0.3)"
                        name="Actifs"
                      />
                      <Area
                        type="monotone"
                        dataKey="trial_users"
                        stackId="1"
                        stroke="hsl(38 92% 50%)"
                        fill="hsl(38 92% 50% / 0.3)"
                        name="Trial"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="growth" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nouveaux Inscrits par Mois</CardTitle>
                  <CardDescription>Acquisition d'utilisateurs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart data={analytics || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(value) => {
                          const [year, month] = value.split("-");
                          return `${month}/${year.slice(2)}`;
                        }}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="new_signups"
                        fill="hsl(221 83% 53%)"
                        radius={[4, 4, 0, 0]}
                        name="Nouveaux"
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Churn vs Croissance</CardTitle>
                  <CardDescription>Comparaison mensuelle</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <LineChart data={analytics || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(value) => {
                          const [year, month] = value.split("-");
                          return `${month}/${year.slice(2)}`;
                        }}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="active_users"
                        stroke="hsl(142 76% 36%)"
                        strokeWidth={2}
                        dot={false}
                        name="Actifs"
                      />
                      <Line
                        type="monotone"
                        dataKey="churned_users"
                        stroke="hsl(0 84% 60%)"
                        strokeWidth={2}
                        dot={false}
                        name="Churned"
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Growth Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Résumé de Croissance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{analytics?.reduce((sum, m) => sum + (m.new_signups || 0), 0) || 0}</p>
                    <p className="text-sm text-muted-foreground">Total inscriptions (12 mois)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {((analytics?.reduce((sum, m) => sum + (m.new_signups || 0), 0) || 0) / 12).toFixed(0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Moyenne mensuelle</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{conversionRate}%</p>
                    <p className="text-sm text-muted-foreground">Taux conversion global</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-destructive">{churnRate}%</p>
                    <p className="text-sm text-muted-foreground">Taux churn mensuel</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cohorts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analyse par Cohortes</CardTitle>
                <CardDescription>Performance par mois d'inscription</CardDescription>
              </CardHeader>
              <CardContent>
                {cohortData && cohortData.length > 0 ? (
                  <>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full mb-6">
                      <BarChart data={cohortData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="converted" fill="hsl(142 76% 36%)" name="Convertis" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="churned" fill="hsl(0 84% 60%)" name="Perdus" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Cohorte</th>
                            <th className="text-center py-2 px-3 font-medium">Total</th>
                            <th className="text-center py-2 px-3 font-medium">Convertis</th>
                            <th className="text-center py-2 px-3 font-medium">Actifs</th>
                            <th className="text-center py-2 px-3 font-medium">Perdus</th>
                            <th className="text-center py-2 px-3 font-medium">Conversion</th>
                            <th className="text-center py-2 px-3 font-medium">Rétention</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohortData.map((cohort, index) => (
                            <tr key={index} className="border-b last:border-0">
                              <td className="py-2 px-3 font-medium">{cohort.month}</td>
                              <td className="py-2 px-3 text-center">{cohort.total}</td>
                              <td className="py-2 px-3 text-center text-green-600">{cohort.converted}</td>
                              <td className="py-2 px-3 text-center text-blue-600">{cohort.active}</td>
                              <td className="py-2 px-3 text-center text-destructive">{cohort.churned}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={Number(cohort.conversionRate) > 20 ? "text-green-600 font-medium" : ""}>
                                  {cohort.conversionRate}%
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={Number(cohort.retentionRate) > 50 ? "text-green-600 font-medium" : ""}>
                                  {cohort.retentionRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Pas assez de données pour l'analyse par cohortes
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Stripe Placeholder */}
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
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