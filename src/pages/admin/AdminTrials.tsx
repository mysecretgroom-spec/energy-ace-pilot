import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, MetricGrid, MetricTile, StatusPill, num } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { deliverFile } from "@/lib/fileDelivery";
import { trialStatus, type TrialRow } from "@/lib/trialStatus";

const fmt = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy", { locale: fr }) : "—");
const LABEL = { converted: "Converti", active: "En cours", expired: "Expiré" } as const;
const TONE = { converted: "good", active: "info", expired: "bad" } as const;

export default function AdminTrials() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-trials"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_trials" as any);
      if (error) throw error;
      return (data as TrialRow[]) ?? [];
    },
  });

  const rows = useMemo(() => {
    const now = new Date();
    return (data ?? [])
      .map((r) => ({ ...r, status: trialStatus(r, now) }))
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !search || r.email?.toLowerCase().includes(search.toLowerCase()));
  }, [data, filter, search]);

  const stats = useMemo(() => {
    const all = (data ?? []).map((r) => trialStatus(r, new Date()));
    const converted = all.filter((s) => s === "converted").length;
    const finished = all.filter((s) => s !== "active").length;
    return { total: all.length, active: all.filter((s) => s === "active").length, converted, rate: finished ? Math.round((converted / finished) * 100) : 0 };
  }, [data]);

  const exportCsv = () => {
    const head = "email;inscription;debut_essai;fin_essai;statut;converti_le\n";
    const body = rows.map((r) => [r.email, r.signed_up_at, r.trial_started_at, r.trial_ends_at, LABEL[r.status], r.converted_at ?? ""].join(";")).join("\n");
    deliverFile(new Blob([head + body], { type: "text/csv" }), `essais-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="Essais gratuits" description="Chaque inscription à l'essai de 10 jours, avec début, fin et conversion"
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5 mr-1.5" />Exporter</Button>} />
      {error ? <PageError onRetry={() => refetch()} /> : (
        <div className="space-y-6">
          <MetricGrid className="grid-cols-2 md:grid-cols-4">
            <MetricTile label="Inscriptions" loading={isLoading} value={num(stats.total)} />
            <MetricTile label="Essais en cours" loading={isLoading} value={num(stats.active)} />
            <MetricTile label="Convertis" loading={isLoading} value={num(stats.converted)} />
            <MetricTile label="Taux de conversion" loading={isLoading} value={`${stats.rate} %`} sub="sur les essais terminés" />
          </MetricGrid>
          <section className="bg-card border rounded-md">
            <div className="flex flex-col sm:flex-row gap-3 p-3 border-b">
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="E-mail…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="sm:w-48 sm:ml-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">En cours</SelectItem>
                  <SelectItem value="converted">Convertis</SelectItem>
                  <SelectItem value="expired">Expirés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="text-left font-semibold px-4 py-2.5">Compte</th>
                    <th className="text-left font-semibold px-4 py-2.5">Début</th>
                    <th className="text-left font-semibold px-4 py-2.5">Fin</th>
                    <th className="text-left font-semibold px-4 py-2.5">Statut</th>
                    <th className="text-left font-semibold px-4 py-2.5">Converti le</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? [0, 1, 2].map((i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  )) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucune inscription</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{r.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(r.trial_started_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(r.trial_ends_at)}</td>
                      <td className="px-4 py-3"><StatusPill tone={TONE[r.status]}>{LABEL[r.status]}</StatusPill></td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(r.converted_at)}</td>
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
