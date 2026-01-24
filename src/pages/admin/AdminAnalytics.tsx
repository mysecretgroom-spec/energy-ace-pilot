import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Users, UserPlus } from "lucide-react";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

interface AnalyticsData {
  month: string;
  total_users: number;
  trial_users: number;
  active_users: number;
  churned_users: number;
  new_signups: number;
}

const chartConfig = {
  total_users: {
    label: "Total",
    color: "hsl(var(--primary))",
  },
  active_users: {
    label: "Actifs",
    color: "hsl(142 76% 36%)",
  },
  trial_users: {
    label: "En trial",
    color: "hsl(38 92% 50%)",
  },
  churned_users: {
    label: "Churned",
    color: "hsl(0 84% 60%)",
  },
  new_signups: {
    label: "Nouveaux",
    color: "hsl(221 83% 53%)",
  },
};

export default function AdminAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revenue_analytics" as any);
      if (error) throw error;
      return (data as AnalyticsData[]) || [];
    },
  });

  // Calculate metrics
  const currentMonth = analytics?.[analytics.length - 1];
  const previousMonth = analytics?.[analytics.length - 2];

  const growthRate = previousMonth && currentMonth
    ? ((currentMonth.active_users - previousMonth.active_users) / (previousMonth.active_users || 1) * 100).toFixed(1)
    : "0";

  const churnRate = currentMonth
    ? ((currentMonth.churned_users / (currentMonth.total_users || 1)) * 100).toFixed(1)
    : "0";

  const conversionRate = currentMonth && currentMonth.trial_users > 0
    ? ((currentMonth.active_users / (currentMonth.trial_users + currentMonth.active_users)) * 100).toFixed(1)
    : "0";

  if (isLoading) {
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
          <p className="text-muted-foreground mt-1">Métriques de croissance et revenus</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs Actifs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMonth?.active_users || 0}</div>
              <p className="text-xs text-muted-foreground">
                {Number(growthRate) >= 0 ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> +{growthRate}% vs mois dernier
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> {growthRate}% vs mois dernier
                  </span>
                )}
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
              <p className="text-xs text-muted-foreground">Ce mois-ci</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux de Conversion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">Trial → Payant</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux de Churn</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{churnRate}%</div>
              <p className="text-xs text-muted-foreground">Utilisateurs perdus</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Nouveaux Inscrits par Mois</CardTitle>
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

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Churn vs Croissance</CardTitle>
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

        {/* Info Card for Stripe */}
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
