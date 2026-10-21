import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { AdminPageHeader, StatusPill } from "@/components/admin/AdminUI";
import { PageError } from "@/components/common/PageState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, ChevronDown, Shield, User, Bell, CreditCard, Settings } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: string; admin_email: string; action: string; target_type: string; target_id: string | null;
  details: Record<string, any>; created_at: string;
}

const ICONS: Record<string, typeof User> = { user: User, subscription: CreditCard, notification: Bell, settings: Settings, security: Shield };
const tone = (action: string) => {
  const a = action.split("_")[0];
  return a === "delete" || a === "block" ? "bad" : a === "create" || a === "unblock" ? "good" : a === "update" ? "info" : "neutral";
};
const PER_PAGE = 25;

export default function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-audit-logs", action, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audit_logs" as any, {
        p_limit: PER_PAGE, p_offset: page * PER_PAGE, p_action_filter: action === "all" ? null : action,
      });
      if (error) throw error;
      return (data as AuditLog[]) ?? [];
    },
  });

  const q = search.trim().toLowerCase();
  const rows = (logs ?? []).filter((l) => !q ||
    [l.admin_email, l.action, l.target_type, l.target_id].some((v) => v?.toLowerCase().includes(q)));

  return (
    <AdminLayout>
      <AdminPageHeader title="Journal d'audit" description="Toutes les actions effectuées depuis la console admin" />
      {error ? <PageError onRetry={() => refetch()} /> : (
        <section className="bg-card border rounded-md">
          <div className="flex flex-col sm:flex-row gap-3 p-3 border-b">
            <div className="relative sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Admin, action, cible…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
            </div>
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
              <SelectTrigger className="h-8 sm:w-52 sm:ml-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                <SelectItem value="create_user">Création</SelectItem>
                <SelectItem value="update_user">Modification</SelectItem>
                <SelectItem value="block_user">Blocage</SelectItem>
                <SelectItem value="unblock_user">Déblocage</SelectItem>
                <SelectItem value="send_notification">Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ul>
            {isLoading && [1, 2, 3, 4].map((i) => <li key={i} className="border-b px-4 py-3"><Skeleton className="h-5 w-full" /></li>)}
            {!isLoading && !rows.length && (
              <li className="text-center py-12 text-sm text-muted-foreground">Aucune action enregistrée.</li>
            )}
            {rows.map((l) => {
              const Icon = ICONS[l.target_type] ?? Settings;
              const hasDetails = Object.keys(l.details || {}).length > 0;
              const isOpen = open === l.id;
              return (
                <li key={l.id} className="border-b last:border-0">
                  <button onClick={() => hasDetails && setOpen(isOpen ? null : l.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition-colors duration-100">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{format(new Date(l.created_at), "d MMM HH:mm", { locale: fr })}</span>
                    <StatusPill tone={tone(l.action) as any}>{l.action.replace(/_/g, " ")}</StatusPill>
                    <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono text-xs">{l.target_id ? l.target_id.slice(0, 8) : l.target_type}</span>
                    </span>
                    <span className="ml-auto truncate text-xs text-muted-foreground hidden md:inline max-w-[220px]">{l.admin_email || "Système"}</span>
                    {hasDetails && <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                  </button>
                  {isOpen && (
                    <pre className="mx-4 mb-3 rounded-sm bg-muted p-3 text-xs overflow-x-auto">{JSON.stringify(l.details, null, 2)}</pre>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />Précédent
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(logs?.length ?? 0) < PER_PAGE}>
                Suivant<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
