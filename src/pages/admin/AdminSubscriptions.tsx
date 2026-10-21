import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, MetricGrid, MetricTile, StatusPill, eur, num } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getPaddleEnvironment } from "@/lib/paddle";
import { PLANS, tierOfPriceId } from "@/lib/plans";
import { deliverFile } from "@/lib/fileDelivery";

interface Sub {
  id: string; user_id: string; price_id: string; status: string; current_period_end: string | null;
  cancel_at_period_end: boolean; scheduled_price_id: string | null; created_at: string; updated_at: string;
  email: string | null; name: string | null;
}

const mrrOf = (priceId: string) => {
  const t = tierOfPriceId(priceId);
  if (!t) return 0;
  return priceId.endsWith("yearly") ? PLANS[t].yearly / 12 : PLANS[t].monthly;
};
const planLabel = (p: string) => {
  const t = tierOfPriceId(p);
  return t ? `${PLANS[t].name} ${p.endsWith("yearly") ? "annuel" : "mensuel"}` : p;
};

type F = "all" | "active" | "past_due" | "canceling" | "canceled";
const FILTERS: { key: F; label: string }[] = [
  { key: "all", label: "Tous" }, { key: "active", label: "Actifs" }, { key: "past_due", label: "Impayés" },
  { key: "canceling", label: "Résiliation prévue" }, { key: "canceled", label: "Annulés" },
];
const match = (s: Sub, f: F) =>
  f === "all" ? true
  : f === "active" ? (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end
  : f === "canceling" ? s.cancel_at_period_end && s.status !== "canceled"
  : s.status === f;

function StatusOf({ s }: { s: Sub }) {
  if (s.status === "past_due") return <StatusPill tone="warn">Impayé</StatusPill>;
  if (s.status === "canceled") return <StatusPill>Annulé</StatusPill>;
  if (s.cancel_at_period_end) return <StatusPill tone="bad">Résiliation prévue</StatusPill>;
  if (s.status === "active" || s.status === "trialing") return <StatusPill tone="good">Actif</StatusPill>;
  return <StatusPill>{s.status}</StatusPill>;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const env = getPaddleEnvironment();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<F>("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-subscriptions", env],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_subscriptions" as any, { p_env: env });
      if (error) throw error;
      return (data as unknown as Sub[]) ?? [];
    },
  });

  const stats = useMemo(() => {
    const subs = data ?? [];
    const live = subs.filter((s) => s.status === "active" || s.status === "trialing");
    return {
      mrr: live.filter((s) => !s.cancel_at_period_end).reduce((a, s) => a + mrrOf(s.price_id), 0),
      active: live.length,
      atRisk: subs.filter((s) => s.status === "past_due" || (s.cancel_at_period_end && s.status !== "canceled"))
        .reduce((a, s) => a + mrrOf(s.price_id), 0),
      yearly: live.filter((s) => s.price_id.endsWith("yearly")).length,
      counts: Object.fromEntries(FILTERS.map((f) => [f.key, subs.filter((s) => match(s, f.key)).length])),
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((s) => match(s, filter) &&
      (!q || s.email?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)));
  }, [data, filter, search]);

  const exportCsv = () => {
    const lines = [["email", "offre", "statut", "mrr", "echeance"],
      ...rows.map((s) => [s.email ?? "", planLabel(s.price_id), s.status, mrrOf(s.price_id).toFixed(2), s.current_period_end?.slice(0, 10) ?? ""])];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    deliverFile(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `abonnements-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="Abonnements" description={`Abonnements payants ${env === "sandbox" ? "(mode test)" : ""}`}
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5 mr-1.5" />Exporter</Button>} />
      {error ? <PageError onRetry={() => refetch()} /> : (
        <div className="space-y-6">
          <MetricGrid className="grid-cols-2 md:grid-cols-4">
            <MetricTile label="MRR" loading={isLoading} value={eur(stats.mrr)} sub={`ARR ${eur(stats.mrr * 12)}`} />
            <MetricTile label="Actifs" loading={isLoading} value={num(stats.active)} />
            <MetricTile label="Annuels" loading={isLoading} value={num(stats.yearly)}
              sub={stats.active ? `${Math.round((stats.yearly / stats.active) * 100)} % des actifs` : "—"} />
            <MetricTile label="MRR à risque" loading={isLoading} value={eur(stats.atRisk)} sub="Impayés et résiliations prévues" />
          </MetricGrid>

          <section className="bg-card border rounded-md">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 border-b">
              <div className="flex gap-1 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={cn("h-8 px-3 rounded-md text-sm whitespace-nowrap transition-colors duration-100",
                      filter === f.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {f.label} <span className="tabular-nums text-xs text-muted-foreground ml-1">{stats.counts[f.key] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="relative lg:ml-auto lg:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Nom ou email…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="text-left font-semibold px-4 py-2.5">Compte</th>
                    <th className="text-left font-semibold px-3 py-2.5">Offre</th>
                    <th className="text-left font-semibold px-3 py-2.5">Statut</th>
                    <th className="text-right font-semibold px-3 py-2.5">MRR</th>
                    <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Échéance</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && [1, 2, 3].map((i) => <tr key={i} className="border-b"><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)}
                  {!isLoading && !rows.length && (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Aucun abonnement pour l'instant.</td></tr>
                  )}
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => navigate(`/admin/users?u=${s.user_id}`)}
                      className={cn("border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors duration-100", s.status === "past_due" && "bg-warning/5")}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium truncate max-w-[240px]">{s.name || s.email || "—"}</div>
                        {s.name && <div className="text-xs text-muted-foreground truncate max-w-[240px]">{s.email}</div>}
                      </td>
                      <td className="px-3">
                        {planLabel(s.price_id)}
                        {s.scheduled_price_id && <div className="text-xs text-muted-foreground">→ {planLabel(s.scheduled_price_id)}</div>}
                      </td>
                      <td className="px-3"><StatusOf s={s} /></td>
                      <td className="px-3 text-right tabular-nums">{eur(mrrOf(s.price_id), 2)}</td>
                      <td className="px-3 text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                        {s.current_period_end ? format(new Date(s.current_period_end), "d MMM yyyy", { locale: fr }) : "—"}
                      </td>
                      <td className="pr-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
