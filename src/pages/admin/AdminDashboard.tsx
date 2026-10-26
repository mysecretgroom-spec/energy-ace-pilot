import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, Delta, MetricGrid, MetricTile, Panel, eur, num, pct } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { getPaddleEnvironment } from "@/lib/paddle";
import PendingDocumentsWidget from "@/components/admin/PendingDocumentsWidget";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export interface AdminMetrics {
  mrr: number; mrr_at_risk: number; paying: number; past_due: number; canceled_30d: number;
  plan_split: Record<string, number>;
  mrr_series: { d: string; mrr: number }[];
  users_total: number; access: Record<string, number>; beta: number;
  signups_series: { d: string; n: number }[]; signups_30d: number; signups_prev_30d: number;
  active_users_7d: number; active_users_30d: number;
  ai_cost_30d: number; ai_calls_30d: number; ai_top_functions: { f: string; n: number; c: number }[];
  etudes_30d: number; docs_30d: number; rdv_30d: number; whatsapp_30d: number; jobs_failed_7d: number;
  activity_series: { d: string; etudes: number; docs: number; rdv: number }[];
  top_accounts: { user_id: string; email: string; name: string; rdv: number; etudes: number; ai: number }[];
}

export function useAdminMetrics() {
  const env = getPaddleEnvironment();
  return useQuery({
    queryKey: ["admin-metrics", env],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_metrics" as any, { p_env: env });
      if (error) throw error;
      return data as unknown as AdminMetrics;
    },
  });
}

const axis = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipStyle = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
};
const dlabel = (d: string) => format(parseISO(d), "d MMM", { locale: fr });

const PLAN_LABELS: Record<string, string> = {
  classique_monthly: "Classique mensuel", classique_yearly: "Classique annuel",
  premium_monthly: "Premium mensuel", premium_yearly: "Premium annuel",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: m, isLoading, error, refetch, isFetching } = useAdminMetrics();

  const derived = useMemo(() => {
    if (!m) return null;
    const arpa = m.paying ? m.mrr / m.paying : 0;
    const trial = m.access?.trial ?? 0;
    const conv = pct(m.paying, m.paying + trial + (m.access?.paywall ?? 0));
    const churn = pct(m.canceled_30d, m.paying + m.canceled_30d);
    const signupDelta = m.signups_prev_30d ? ((m.signups_30d - m.signups_prev_30d) / m.signups_prev_30d) * 100 : null;
    const mrr30 = m.mrr_series?.[m.mrr_series.length - 31]?.mrr ?? 0;
    const mrrDelta = mrr30 ? ((m.mrr - mrr30) / mrr30) * 100 : null;
    const stickiness = pct(m.active_users_7d, m.active_users_30d);
    return { arpa, trial, conv, churn, signupDelta, mrrDelta, stickiness };
  }, [m]);

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Tableau de bord"
        description="Revenus, croissance et santé du produit en temps réel"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />Actualiser
          </Button>
        }
      />

      {error ? (
        <PageError title="Indicateurs indisponibles" onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {/* Revenue */}
          <MetricGrid className="grid-cols-2 lg:grid-cols-4">
            <MetricTile label="MRR" loading={isLoading} value={eur(m?.mrr ?? 0)}
              delta={<Delta value={derived?.mrrDelta ?? null} />} sub={`ARR ${eur((m?.mrr ?? 0) * 12)}`} />
            <MetricTile label="Abonnés payants" loading={isLoading} value={num(m?.paying ?? 0)}
              sub={`ARPA ${eur(derived?.arpa ?? 0, 2)} / mois`} onClick={() => navigate("/admin/subscriptions")} />
            <MetricTile label="Conversion essai → payant" loading={isLoading}
              value={derived?.conv == null ? "—" : `${derived.conv.toFixed(1)} %`} sub={`${num(derived?.trial ?? 0)} en essai`} />
            <MetricTile label="MRR à risque" loading={isLoading} value={eur(m?.mrr_at_risk ?? 0)}
              sub={`${num(m?.past_due ?? 0)} impayés · churn 30 j ${derived?.churn == null ? "—" : derived.churn.toFixed(1) + " %"}`} />
          </MetricGrid>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Évolution du MRR" description="90 derniers jours" className="lg:col-span-2" bodyClassName="p-2 pt-4">
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={m?.mrr_series ?? []} margin={{ left: 8, right: 16 }}>
                    <defs>
                      <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="d" tickFormatter={dlabel} tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => eur(v)} />
                    <Tooltip {...tooltipStyle} labelFormatter={dlabel} formatter={(v: number) => [eur(v, 2), "MRR"]} />
                    <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mrrFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Répartition par offre" description="Abonnements actifs">
              {isLoading ? null : Object.keys(m?.plan_split ?? {}).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun abonnement payant pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {Object.entries(m!.plan_split).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
                    const share = pct(n, m!.paying + m!.past_due) ?? 0;
                    return (
                      <li key={k}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{PLAN_LABELS[k] ?? k}</span>
                          <span className="tabular-nums text-muted-foreground">{n} · {share.toFixed(0)} %</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* Growth */}
          <MetricGrid className="grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Comptes" loading={isLoading} value={num(m?.users_total ?? 0)}
              sub={`${num(m?.beta ?? 0)} bêta-testeurs`} onClick={() => navigate("/admin/users")} />
            <MetricTile label="Inscriptions 30 j" loading={isLoading} value={num(m?.signups_30d ?? 0)}
              delta={<Delta value={derived?.signupDelta ?? null} />} sub={`${num(m?.signups_prev_30d ?? 0)} les 30 j précédents`} />
            <MetricTile label="Actifs 7 j / 30 j" loading={isLoading}
              value={`${num(m?.active_users_7d ?? 0)} / ${num(m?.active_users_30d ?? 0)}`}
              sub={`Rétention hebdo ${derived?.stickiness == null ? "—" : derived.stickiness.toFixed(0) + " %"}`} />
            <MetricTile label="Coût IA 30 j" loading={isLoading} value={`${(m?.ai_cost_30d ?? 0).toFixed(2)} $`}
              sub={`${num(m?.ai_calls_30d ?? 0)} appels`} />
          </MetricGrid>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Inscriptions" description="Par jour, 90 jours" bodyClassName="p-2 pt-4">
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={m?.signups_series ?? []} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="d" tickFormatter={dlabel} tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={dlabel} formatter={(v: number) => [v, "Inscriptions"]} />
                    <Bar dataKey="n" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Usage produit" description="RDV, études et documents créés — 30 jours" bodyClassName="p-2 pt-4">
              <div className="h-56">
                <ResponsiveContainer>
                  <AreaChart data={m?.activity_series ?? []} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="d" tickFormatter={dlabel} tick={axis} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={dlabel} />
                    <Area type="monotone" dataKey="rdv" name="RDV" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="etudes" name="Études" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.12)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="docs" name="Documents" stroke="hsl(var(--muted-foreground))" fill="transparent" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Product health */}
          <MetricGrid className="grid-cols-2 lg:grid-cols-5">
            <MetricTile label="RDV 30 j" loading={isLoading} value={num(m?.rdv_30d ?? 0)} />
            <MetricTile label="Études 30 j" loading={isLoading} value={num(m?.etudes_30d ?? 0)} />
            <MetricTile label="Documents 30 j" loading={isLoading} value={num(m?.docs_30d ?? 0)} />
            <MetricTile label="Messages WhatsApp 30 j" loading={isLoading} value={num(m?.whatsapp_30d ?? 0)} />
            <MetricTile label="Tâches en échec 7 j" loading={isLoading} value={num(m?.jobs_failed_7d ?? 0)}
              sub={(m?.jobs_failed_7d ?? 0) > 0 ? "À surveiller" : "Aucun incident"} />
          </MetricGrid>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Comptes les plus actifs" description="30 derniers jours" className="lg:col-span-2" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="text-left font-semibold px-5 py-2.5">Compte</th>
                      <th className="text-right font-semibold px-3 py-2.5">RDV</th>
                      <th className="text-right font-semibold px-3 py-2.5">Études</th>
                      <th className="text-right font-semibold px-5 py-2.5">Coût IA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(m?.top_accounts ?? []).map((a) => (
                      <tr key={a.user_id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/admin/users?u=${a.user_id}`)}>
                        <td className="px-5 py-2.5">
                          <div className="font-medium truncate max-w-[260px]">{a.name || a.email}</div>
                          {a.name && <div className="text-xs text-muted-foreground truncate max-w-[260px]">{a.email}</div>}
                        </td>
                        <td className="text-right px-3 tabular-nums">{a.rdv}</td>
                        <td className="text-right px-3 tabular-nums">{a.etudes}</td>
                        <td className="text-right px-5 tabular-nums">{Number(a.ai).toFixed(2)} $</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Coût IA par fonction" description="30 derniers jours">
              <ul className="space-y-2.5">
                {(m?.ai_top_functions ?? []).map((f) => (
                  <li key={f.f} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-mono text-xs">{f.f}</span>
                    <span className="tabular-nums text-muted-foreground whitespace-nowrap">{f.n} · {Number(f.c ?? 0).toFixed(2)} $</span>
                  </li>
                ))}
                {!isLoading && !(m?.ai_top_functions ?? []).length && <p className="text-sm text-muted-foreground">Aucun appel IA.</p>}
              </ul>
            </Panel>
          </div>

          <PendingDocumentsWidget />
        </div>
      )}
    </AdminLayout>
  );
}
