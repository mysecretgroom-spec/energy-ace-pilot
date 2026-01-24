import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, ChevronLeft, ChevronRight, Shield, User, Bell, CreditCard, Settings } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  subscription: <CreditCard className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  view: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  block: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  unblock: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  send: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
};

const ITEMS_PER_PAGE = 20;

export default function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audit_logs" as any, {
        p_limit: ITEMS_PER_PAGE,
        p_offset: page * ITEMS_PER_PAGE,
        p_action_filter: actionFilter === "all" ? null : actionFilter,
      });
      if (error) throw error;
      return (data as AuditLog[]) || [];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.admin_email?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.target_type.toLowerCase().includes(searchLower) ||
      log.target_id?.toLowerCase().includes(searchLower)
    );
  });

  const getActionBadge = (action: string) => {
    const actionType = action.split("_")[0];
    const colorClass = ACTION_COLORS[actionType] || "bg-gray-100 text-gray-800";
    return (
      <Badge variant="outline" className={colorClass}>
        {action.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getTargetIcon = (targetType: string) => {
    return ACTION_ICONS[targetType] || <Settings className="h-4 w-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Logs d'Audit</h1>
          <p className="text-muted-foreground mt-1">Historique des actions administratives</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par action" />
                </SelectTrigger>
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.admin_email || "Système"}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTargetIcon(log.target_type)}
                            <span className="text-sm capitalize">{log.target_type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {log.target_id ? log.target_id.slice(0, 8) + "..." : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {Object.keys(log.details || {}).length > 0
                            ? JSON.stringify(log.details).slice(0, 50) + "..."
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={filteredLogs.length < ITEMS_PER_PAGE}
                    >
                      Suivant
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun log d'audit trouvé</p>
                <p className="text-sm mt-1">Les actions admin seront enregistrées ici</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
