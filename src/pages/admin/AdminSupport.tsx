import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, MetricGrid, MetricTile, StatusPill, num } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Loader2, Send, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
interface SaasUser { user_id: string; email: string; first_name: string; last_name: string }
interface Ticket { id: string; user_id: string; subject: string; message: string; status: string; created_at: string; updated_at: string; user?: SaasUser }
interface Reply { id: string; is_admin: boolean; message: string; created_at: string }

const STATUS: Record<string, { label: string; tone: "info" | "warn" | "good" | "neutral" }> = {
  open: { label: "Ouvert", tone: "info" }, in_progress: { label: "En cours", tone: "warn" },
  resolved: { label: "Résolu", tone: "good" }, closed: { label: "Fermé", tone: "neutral" },
};
const FILTERS: { key: TicketStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous" }, { key: "open", label: "Ouverts" }, { key: "in_progress", label: "En cours" },
  { key: "resolved", label: "Résolus" }, { key: "closed", label: "Fermés" },
];

export default function AdminSupport() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: tickets, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const [{ data: t, error }, { data: users }] = await Promise.all([
        supabase.rpc("get_all_support_tickets" as any),
        supabase.rpc("get_saas_users" as any),
      ]);
      if (error) throw error;
      const byId = new Map(((users as SaasUser[]) ?? []).map((u) => [u.user_id, u]));
      return ((t as Ticket[]) ?? []).map((x) => ({ ...x, user: byId.get(x.user_id) }));
    },
  });
  const selected = tickets?.find((t) => t.id === selectedId) ?? null;

  const { data: replies, isLoading: loadingReplies, refetch: refetchReplies } = useQuery({
    queryKey: ["admin-ticket-replies", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket_replies" as any, { p_ticket_id: selectedId });
      if (error) throw error;
      return (data as Reply[]) ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_ticket_reply" as any, { p_ticket_id: selectedId, p_message: reply, p_is_admin: true });
      if (error) throw error;
    },
    onSuccess: () => { setReply(""); refetchReplies(); toast.success("Réponse envoyée"); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });
  const setStatus = useMutation({
    mutationFn: async (s: TicketStatus) => {
      const { error } = await supabase.rpc("update_ticket_status" as any, { p_ticket_id: selectedId, p_status: s });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-support-tickets"] }),
    onError: () => toast.error("Statut non mis à jour"),
  });

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) =>
    [f.key, (tickets ?? []).filter((t) => f.key === "all" || t.status === f.key).length])), [tickets]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tickets ?? []).filter((t) => (filter === "all" || t.status === filter) &&
      (!q || t.subject?.toLowerCase().includes(q) || t.user?.email?.toLowerCase().includes(q)));
  }, [tickets, filter, search]);
  const oldestOpen = useMemo(() => (tickets ?? []).filter((t) => t.status === "open")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0], [tickets]);

  return (
    <AdminLayout>
      <AdminPageHeader title="Support" description="Demandes des utilisateurs et réponses" />
      {error ? <PageError onRetry={() => refetch()} /> : (
        <div className="space-y-6">
          <MetricGrid className="grid-cols-2 md:grid-cols-4">
            <MetricTile label="Ouverts" loading={isLoading} value={num(counts.open ?? 0)} />
            <MetricTile label="En cours" loading={isLoading} value={num(counts.in_progress ?? 0)} />
            <MetricTile label="Résolus" loading={isLoading} value={num((counts.resolved ?? 0) + (counts.closed ?? 0))} />
            <MetricTile label="Plus ancien ouvert" loading={isLoading}
              value={oldestOpen ? formatDistanceToNow(new Date(oldestOpen.created_at), { locale: fr }) : "—"}
              sub={oldestOpen ? "Sans réponse finale" : "Aucun en attente"} />
          </MetricGrid>

          <section className="bg-card border rounded-md">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 border-b">
              <div className="flex gap-1 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={cn("h-8 px-3 rounded-md text-sm whitespace-nowrap transition-colors duration-100",
                      filter === f.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {f.label} <span className="tabular-nums text-xs text-muted-foreground ml-1">{counts[f.key] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="relative lg:ml-auto lg:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Sujet ou email…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
              </div>
            </div>
            <ul>
              {isLoading && [1, 2, 3].map((i) => <li key={i} className="border-b px-4 py-3"><Skeleton className="h-10 w-full" /></li>)}
              {!isLoading && !rows.length && <li className="text-center py-12 text-sm text-muted-foreground">Aucune demande.</li>}
              {rows.map((t) => (
                <li key={t.id} onClick={() => setSelectedId(t.id)}
                  className="flex items-center gap-3 border-b last:border-0 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors duration-100">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.subject}</span>
                      <StatusPill tone={STATUS[t.status]?.tone ?? "neutral"}>{STATUS[t.status]?.label ?? t.status}</StatusPill>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.user?.email ?? "—"} · {t.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {formatDistanceToNow(new Date(t.updated_at || t.created_at), { locale: fr, addSuffix: true })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-4">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="font-display pr-6">{selected.subject}</SheetTitle>
                <SheetDescription>
                  {[selected.user?.first_name, selected.user?.last_name].filter(Boolean).join(" ")} {selected.user?.email} · {format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                <span className="text-sm text-muted-foreground">Statut</span>
                <Select value={selected.status} onValueChange={(v) => setStatus.mutate(v as TicketStatus)}>
                  <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                <Bubble mine={false} text={selected.message} at={selected.created_at} />
                {loadingReplies && <Skeleton className="h-12 w-2/3" />}
                {(replies ?? []).map((r) => <Bubble key={r.id} mine={r.is_admin} text={r.message} at={r.created_at} />)}
              </div>
              <div className="space-y-2 border-t pt-3">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Votre réponse…" rows={3} />
                <Button className="w-full" onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}>
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}Envoyer
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

function Bubble({ mine, text, at }: { mine: boolean; text: string; at: string }) {
  return (
    <div className={cn("max-w-[85%] rounded-md border px-3 py-2 text-sm", mine ? "ml-auto bg-primary/10 border-primary/20" : "bg-muted/50")}>
      <p className="whitespace-pre-wrap">{text}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{mine ? "Admin" : "Utilisateur"} · {format(new Date(at), "d MMM HH:mm", { locale: fr })}</p>
    </div>
  );
}
