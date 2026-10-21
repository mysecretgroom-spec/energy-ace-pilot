import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, MetricGrid, MetricTile, StatusPill, num } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, Loader2, AlertTriangle, Download, ChevronRight } from "lucide-react";
import { format, differenceInDays, addDays, addMonths, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deliverFile } from "@/lib/fileDelivery";

interface AdminUser {
  user_id: string; email: string; first_name: string | null; last_name: string | null; created_at: string;
  app_access: string | null; is_beta_tester: boolean; trial_started_at: string | null; trial_ends_at: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null;
  current_period_end: string | null; past_due_since: string | null; beta_expires_at: string | null;
}
interface User360 {
  rdv_total: number; rdv_30d: number; clients: number; etudes: number; ventes: number; documents: number;
  regies: number; ai_cost_30d: number; last_activity: string | null;
  subscription: { price_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
}

type FilterType = "all" | "trial" | "active" | "paywall" | "blocked" | "beta" | "past_due";
const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "Tous" }, { key: "active", label: "Actifs" }, { key: "trial", label: "Essai" },
  { key: "beta", label: "Bêta" }, { key: "past_due", label: "Impayés" }, { key: "paywall", label: "Paywall" },
  { key: "blocked", label: "Bloqués" },
];

const fullName = (u: AdminUser) => `${u.first_name || ""} ${u.last_name || ""}`.trim();

function matches(u: AdminUser, f: FilterType) {
  switch (f) {
    case "trial": return u.app_access === "trial";
    case "active": return u.app_access === "active" && !u.is_beta_tester;
    case "paywall": return u.app_access === "paywall";
    case "blocked": return u.app_access === "blocked";
    case "beta": return u.is_beta_tester;
    case "past_due": return u.subscription_status === "past_due";
    default: return true;
  }
}

function AccessPill({ u }: { u: AdminUser }) {
  if (u.is_beta_tester) {
    const expired = !!u.beta_expires_at && new Date(u.beta_expires_at) < new Date();
    return <StatusPill tone={expired ? "bad" : "info"}>{expired ? "Bêta expiré" : "Bêta"}</StatusPill>;
  }
  switch (u.app_access) {
    case "active": return <StatusPill tone="good">Actif</StatusPill>;
    case "trial": return <StatusPill>Essai</StatusPill>;
    case "paywall": return <StatusPill tone="warn">Paywall</StatusPill>;
    case "blocked": return <StatusPill tone="bad">Bloqué</StatusPill>;
    default: return <StatusPill>{u.app_access || "—"}</StatusPill>;
  }
}

function timeInfo(u: AdminUser) {
  if (u.is_beta_tester) {
    if (!u.beta_expires_at) return "Bêta permanente";
    const d = differenceInDays(new Date(u.beta_expires_at), new Date());
    return d < 0 ? "Bêta expirée" : `Bêta · ${d} j restants`;
  }
  if (u.past_due_since) return `Impayé depuis ${differenceInDays(new Date(), new Date(u.past_due_since))} j`;
  if (u.app_access === "trial" && u.trial_ends_at) {
    const d = differenceInDays(new Date(u.trial_ends_at), new Date());
    return d < 0 ? "Essai expiré" : `Essai · ${d} j restants`;
  }
  if (u.current_period_end) return `Renouvellement ${format(new Date(u.current_period_end), "d MMM", { locale: fr })}`;
  return "—";
}

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("u"));
  const [betaDuration, setBetaDuration] = useState("14");
  const [trialDays, setTrialDays] = useState("15");
  const qc = useQueryClient();

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_users_overview" as any);
      if (error) throw error;
      return data as AdminUser[];
    },
  });

  const selected = users?.find((u) => u.user_id === selectedId) ?? null;

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (selectedId) next.set("u", selectedId); else next.delete("u");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const { data: u360, isLoading: loading360 } = useQuery({
    queryKey: ["admin-user-360", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_user_360" as any, { p_user_id: selectedId });
      if (error) throw error;
      return data as unknown as User360;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users-overview"] });

  const toggleBeta = useMutation({
    mutationFn: async ({ userId, isBeta, expiresAt }: { userId: string; isBeta: boolean; expiresAt: string | null }) => {
      const { error } = await supabase.rpc("toggle_beta_tester" as any, { p_target_user_id: userId, p_is_beta: isBeta, p_beta_expires_at: expiresAt });
      if (error) throw error;
    },
    onSuccess: (_, { isBeta }) => { invalidate(); toast.success(isBeta ? "Bêta-testeur activé" : "Bêta-testeur désactivé"); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });
  const updateAccess = useMutation({
    mutationFn: async ({ userId, access }: { userId: string; access: string }) => {
      const { error } = await supabase.rpc("admin_update_access_state" as any, { p_target_user_id: userId, p_app_access: access });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Accès mis à jour"); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });
  const grantTrial = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      const { error } = await supabase.rpc("admin_grant_trial" as any, { p_target_user_id: userId, p_trial_days: days });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Essai accordé"); },
    onError: () => toast.error("Erreur lors de l'attribution de l'essai"),
  });

  const expiresFor = (k: string) => {
    const now = new Date();
    if (k === "0") return null;
    if (k === "30") return addMonths(now, 1).toISOString();
    if (k === "90") return addMonths(now, 3).toISOString();
    return addDays(now, Number(k) || 14).toISOString();
  };

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, users?.filter((u) => matches(u, f.key)).length ?? 0])), [users]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => matches(u, filter) &&
      (!q || u.email?.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q)));
  }, [users, filter, search]);

  const exportCsv = () => {
    const rows = [["email", "nom", "inscrit", "acces", "beta", "abonnement"],
      ...filtered.map((u) => [u.email, fullName(u), u.created_at.slice(0, 10), u.app_access ?? "", u.is_beta_tester ? "oui" : "non", u.subscription_status ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    deliverFile(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `comptes-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <AdminLayout>
      <AdminPageHeader title="Comptes" description="Tous les comptes, leur accès, leur abonnement et leur usage"
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="h-3.5 w-3.5 mr-1.5" />Exporter</Button>} />

      {error ? <PageError onRetry={() => refetch()} /> : (
        <div className="space-y-6">
          <MetricGrid className="grid-cols-2 md:grid-cols-4">
            <MetricTile label="Total" loading={isLoading} value={num(counts.all)} />
            <MetricTile label="Actifs payants" loading={isLoading} value={num(counts.active)} />
            <MetricTile label="En essai" loading={isLoading} value={num(counts.trial)} />
            <MetricTile label="Impayés" loading={isLoading} value={num(counts.past_due)} sub={counts.past_due ? "Action requise" : "Aucun"} />
          </MetricGrid>

          <section className="bg-card border rounded-md">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 border-b">
              <div className="flex gap-1 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={cn("h-8 px-3 rounded-md text-sm whitespace-nowrap transition-colors duration-100",
                      filter === f.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {f.label} <span className="tabular-nums text-xs text-muted-foreground ml-1">{counts[f.key]}</span>
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
                    <th className="text-left font-semibold px-3 py-2.5">Accès</th>
                    <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Échéance</th>
                    <th className="text-left font-semibold px-3 py-2.5 hidden lg:table-cell">Inscrit</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))}
                  {!isLoading && !filtered.length && (
                    <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Aucun compte ne correspond.</td></tr>
                  )}
                  {filtered.map((u) => (
                    <tr key={u.user_id} onClick={() => setSelectedId(u.user_id)}
                      className={cn("border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors duration-100",
                        u.subscription_status === "past_due" && "bg-warning/5")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-muted grid place-items-center text-xs font-semibold text-muted-foreground uppercase">
                            {(u.first_name?.[0] ?? u.email?.[0] ?? "?")}{u.last_name?.[0] ?? ""}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{fullName(u) || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3"><AccessPill u={u} /></td>
                      <td className="px-3 text-xs text-muted-foreground hidden md:table-cell">{timeInfo(u)}</td>
                      <td className="px-3 text-xs text-muted-foreground tabular-nums hidden lg:table-cell">{format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}</td>
                      <td className="pr-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <SheetTitle className="font-display">{fullName(selected) || selected.email}</SheetTitle>
                <SheetDescription>{selected.email} · inscrit le {format(new Date(selected.created_at), "d MMMM yyyy", { locale: fr })}</SheetDescription>
                <div className="flex gap-2 pt-1"><AccessPill u={selected} />
                  {selected.subscription_status && <StatusPill tone={selected.subscription_status === "past_due" ? "warn" : "neutral"}>Abonnement : {selected.subscription_status}</StatusPill>}
                </div>
              </SheetHeader>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Usage</h3>
                <MetricGrid className="grid-cols-3">
                  {[["RDV", u360?.rdv_total], ["RDV 30 j", u360?.rdv_30d], ["Clients", u360?.clients], ["Études", u360?.etudes],
                    ["Ventes", u360?.ventes], ["Documents", u360?.documents]].map(([l, v]) => (
                    <div key={l as string} className="bg-card p-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p>
                      {loading360 ? <Skeleton className="h-5 w-10 mt-1" /> : <p className="font-display text-lg font-semibold tabular-nums">{num(Number(v ?? 0))}</p>}
                    </div>
                  ))}
                </MetricGrid>
                <p className="text-xs text-muted-foreground mt-2">
                  {u360?.regies ?? 0} régie(s) · coût IA 30 j {Number(u360?.ai_cost_30d ?? 0).toFixed(2)} $ · dernière activité{" "}
                  {u360?.last_activity ? formatDistanceToNow(new Date(u360.last_activity), { locale: fr, addSuffix: true }) : "—"}
                </p>
              </div>

              <div className="border rounded-md divide-y text-sm">
                <Row label="Offre" value={u360?.subscription?.price_id ?? "Aucune"} />
                <Row label="Échéance" value={timeInfo(selected)} />
                {u360?.subscription?.cancel_at_period_end && <Row label="Résiliation" value="En fin de période" />}
                {selected.past_due_since && (
                  <div className="flex items-center justify-between px-3 py-2 text-warning">
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Impayé depuis</span>
                    <span className="font-medium">{format(new Date(selected.past_due_since), "d MMM yyyy", { locale: fr })}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Actions</h3>
                <div className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Bêta-testeur</p><p className="text-xs text-muted-foreground">Accès gratuit pour la durée choisie</p></div>
                    <Switch checked={selected.is_beta_tester} disabled={toggleBeta.isPending}
                      onCheckedChange={(c) => toggleBeta.mutate({ userId: selected.user_id, isBeta: c, expiresAt: c ? expiresFor(betaDuration) : null })} />
                  </div>
                  {!selected.is_beta_tester && (
                    <Select value={betaDuration} onValueChange={setBetaDuration}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 jours</SelectItem><SelectItem value="14">14 jours</SelectItem>
                        <SelectItem value="30">1 mois</SelectItem><SelectItem value="90">3 mois</SelectItem>
                        <SelectItem value="0">Permanent</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selected.app_access === "paywall" && !selected.is_beta_tester && (
                  <div className="border rounded-md p-3 flex items-center gap-2">
                    <Label className="text-sm flex-1">Accorder un essai</Label>
                    <Select value={trialDays} onValueChange={setTrialDays}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{["7", "15", "30", "60"].map((d) => <SelectItem key={d} value={d}>{d} jours</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => grantTrial.mutate({ userId: selected.user_id, days: parseInt(trialDays) })} disabled={grantTrial.isPending}>
                      {grantTrial.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Accorder
                    </Button>
                  </div>
                )}

                <div className="border rounded-md p-3 flex items-center justify-between gap-2">
                  <div><p className="text-sm font-medium">Statut d'accès</p><p className="text-xs text-muted-foreground">Modification manuelle</p></div>
                  <Select value={selected.app_access || "trial"} onValueChange={(v) => updateAccess.mutate({ userId: selected.user_id, access: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Essai</SelectItem><SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="paywall">Paywall</SelectItem><SelectItem value="blocked">Bloqué</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between px-3 py-2"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
