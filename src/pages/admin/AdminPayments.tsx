import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, MetricGrid, MetricTile, StatusPill, eur, num } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Download, Search, Trash2, Loader2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { deliverFile } from "@/lib/fileDelivery";
import { logAdminAction } from "@/hooks/useAuditLog";

interface SaasUser { user_id: string; email: string; first_name: string | null; last_name: string | null }
interface Payment {
  id: string; user_id: string; amount: number; currency: string; method: string; reference: string | null;
  period_label: string | null; paid_at: string; note: string | null; created_at: string;
}

const METHODS: Record<string, string> = { virement: "Virement", cheque: "Chèque", especes: "Espèces", carte: "Carte (hors ligne)", autre: "Autre" };
const empty = { user_id: "", amount: "", method: "virement", reference: "", period_label: "", paid_at: format(new Date(), "yyyy-MM-dd"), note: "" };

export default function AdminPayments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [userQuery, setUserQuery] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-saas-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saas_users" as any);
      if (error) throw error;
      return (data as SaasUser[]) ?? [];
    },
  });
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const label = (id: string) => {
    const u = userMap.get(id);
    if (!u) return "Compte inconnu";
    const n = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return n ? `${n} · ${u.email}` : u.email;
  };

  const { data: payments, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-manual-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manual_payments" as any).select("*").order("paid_at", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Payment[]) ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!form.user_id) throw new Error("Choisissez un compte");
      if (!(amount > 0)) throw new Error("Montant invalide");
      const { data, error } = await supabase.from("manual_payments" as any).insert({
        user_id: form.user_id, amount, method: form.method, paid_at: form.paid_at,
        reference: form.reference.trim() || null, period_label: form.period_label.trim() || null, note: form.note.trim() || null,
      }).select("id").single();
      if (error) throw error;
      await logAdminAction("create_subscription", "subscription", form.user_id, { manual_payment_id: (data as any)?.id, amount, method: form.method });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-manual-payments"] }); toast.success("Paiement enregistré"); setOpen(false); setForm(empty); setUserQuery(""); },
    onError: (e: any) => toast.error(e.message ?? "Enregistrement impossible"),
  });
  const remove = useMutation({
    mutationFn: async (p: Payment) => {
      const { error } = await supabase.from("manual_payments" as any).delete().eq("id", p.id);
      if (error) throw error;
      await logAdminAction("cancel_subscription", "subscription", p.user_id, { manual_payment_deleted: p.id, amount: p.amount });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-manual-payments"] }); toast.success("Paiement supprimé"); },
    onError: () => toast.error("Suppression impossible"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (payments ?? []).filter((p) => (method === "all" || p.method === method) &&
      (!q || label(p.user_id).toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q) || p.period_label?.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, method, search, userMap]);

  const stats = useMemo(() => {
    const all = payments ?? [];
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    return {
      total: all.reduce((a, p) => a + Number(p.amount), 0),
      month: all.filter((p) => p.paid_at >= monthStart).reduce((a, p) => a + Number(p.amount), 0),
      count: all.length,
      accounts: new Set(all.map((p) => p.user_id)).size,
    };
  }, [payments]);

  const exportCsv = () => {
    const lines = [["date", "compte", "email", "montant", "devise", "moyen", "reference", "periode", "note"],
      ...rows.map((p) => {
        const u = userMap.get(p.user_id);
        return [p.paid_at, `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim(), u?.email ?? "", Number(p.amount).toFixed(2).replace(".", ","),
          p.currency, METHODS[p.method] ?? p.method, p.reference ?? "", p.period_label ?? "", p.note ?? ""];
      })];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    deliverFile(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `paiements-manuels-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  const userOptions = (users ?? []).filter((u) => {
    const q = userQuery.trim().toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(q);
  }).slice(0, 50);

  return (
    <AdminLayout>
      <AdminPageHeader title="Paiements manuels" description="Encaissements reçus hors paiement en ligne (virement, chèque…)"
        actions={<>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5 mr-1.5" />Exporter</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Enregistrer</Button>
        </>} />

      {error ? <PageError onRetry={() => refetch()} /> : (
        <div className="space-y-6">
          <MetricGrid className="grid-cols-2 md:grid-cols-4">
            <MetricTile label="Encaissé ce mois" loading={isLoading} value={eur(stats.month, 2)} />
            <MetricTile label="Total encaissé" loading={isLoading} value={eur(stats.total, 2)} />
            <MetricTile label="Paiements" loading={isLoading} value={num(stats.count)} />
            <MetricTile label="Comptes concernés" loading={isLoading} value={num(stats.accounts)} />
          </MetricGrid>

          <section className="bg-card border rounded-md">
            <div className="flex flex-col sm:flex-row gap-3 p-3 border-b">
              <div className="relative sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Compte, référence, période…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
              </div>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-8 sm:w-48 sm:ml-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les moyens</SelectItem>
                  {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="text-left font-semibold px-4 py-2.5">Date</th>
                    <th className="text-left font-semibold px-3 py-2.5">Compte</th>
                    <th className="text-left font-semibold px-3 py-2.5">Moyen</th>
                    <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Référence / période</th>
                    <th className="text-right font-semibold px-3 py-2.5">Montant</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && [1, 2, 3].map((i) => <tr key={i} className="border-b"><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)}
                  {!isLoading && !rows.length && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Aucun paiement manuel enregistré.</td></tr>}
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{format(new Date(p.paid_at), "d MMM yyyy", { locale: fr })}</td>
                      <td className="px-3 max-w-[260px]"><div className="truncate">{label(p.user_id)}</div>
                        {p.note && <div className="text-xs text-muted-foreground truncate">{p.note}</div>}</td>
                      <td className="px-3"><StatusPill>{METHODS[p.method] ?? p.method}</StatusPill></td>
                      <td className="px-3 text-xs text-muted-foreground hidden md:table-cell">{[p.reference, p.period_label].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 text-right tabular-nums font-medium">{eur(Number(p.amount), 2)}</td>
                      <td className="pr-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Supprimer"
                          onClick={() => { if (confirm("Supprimer ce paiement ?")) remove.mutate(p); }}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">Enregistrer un paiement ici sert au suivi comptable : cela ne modifie pas l'abonnement ni l'accès du compte.</p>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Enregistrer un paiement</SheetTitle>
            <SheetDescription>Encaissement reçu en dehors du paiement en ligne.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Compte</Label>
              <Input placeholder="Rechercher un compte…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} className="h-9" />
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{userOptions.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{label(u.user_id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Montant (€)</Label>
                <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-9" placeholder="49,99" /></div>
              <div className="space-y-1.5"><Label>Date</Label>
                <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} className="h-9" /></div>
            </div>
            <div className="space-y-1.5"><Label>Moyen</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Référence</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="h-9" placeholder="N° virement" /></div>
              <div className="space-y-1.5"><Label>Période</Label>
                <Input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} className="h-9" placeholder="Octobre 2026" /></div>
            </div>
            <div className="space-y-1.5"><Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Enregistrer le paiement
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
