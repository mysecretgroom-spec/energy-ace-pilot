import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  Loader2, 
  MoreHorizontal,
  UserCheck,
  UserX,
  Clock,
  Ban,
  RefreshCw,
  Mail,
  Download,
  Users,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  Eye,
  Gift,
  Shield
} from "lucide-react";
import { format, differenceInDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type AppAccess = "trial" | "active" | "paywall" | "blocked" | "all";

interface SaasUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  sector: string | null;
  created_at: string;
}

interface AccessState {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  app_access: string;
}

interface Subscription {
  user_id: string;
  status: string;
  current_period_end: string | null;
}

interface ClientWithDetails extends SaasUser {
  access?: AccessState;
  subscription?: Subscription;
}

export default function AdminClients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppAccess>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionDialog, setActionDialog] = useState<{
    type: "extend_trial" | "grant_access" | "block" | "unblock" | null;
    userIds: string[];
  }>({ type: null, userIds: [] });
  const [trialDays, setTrialDays] = useState(15);

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data: users, error: usersError } = await supabase.rpc("get_saas_users");
      if (usersError) throw usersError;

      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      const { data: subscriptions } = await supabase.rpc("get_all_saas_subscriptions");

      return ((users as SaasUser[]) || []).map((user) => ({
        ...user,
        access: ((accessStates as AccessState[]) || []).find((a) => a.user_id === user.user_id),
        subscription: ((subscriptions as Subscription[]) || []).find((s) => s.user_id === user.user_id),
      })) as ClientWithDetails[];
    },
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, userIds, days }: { action: string; userIds: string[]; days?: number }) => {
      for (const userId of userIds) {
        if (action === "extend_trial") {
          await supabase.rpc("admin_update_access_state" as any, { 
            p_target_user_id: userId, 
            p_app_access: "trial" 
          });
        } else if (action === "grant_access") {
          await supabase.rpc("admin_update_access_state" as any, { 
            p_target_user_id: userId, 
            p_app_access: "active" 
          });
        } else if (action === "block") {
          await supabase.rpc("block_saas_user", { p_user_id: userId });
        } else if (action === "unblock") {
          await supabase.rpc("admin_update_access_state" as any, { 
            p_target_user_id: userId, 
            p_app_access: "trial" 
          });
        }
      }
      
      // Log admin action
      await supabase.rpc("log_admin_action", {
        p_action: action,
        p_target_type: "users",
        p_target_id: userIds.join(","),
        p_details: { count: userIds.length, days },
      });
    },
    onSuccess: () => {
      toast.success("Action effectuée avec succès");
      setSelectedUsers(new Set());
      setActionDialog({ type: null, userIds: [] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const filteredClients = clients?.filter((client) => {
    const matchesSearch = 
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      client.last_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || client.access?.app_access === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: clients?.length || 0,
    trial: clients?.filter(c => c.access?.app_access === "trial").length || 0,
    active: clients?.filter(c => c.access?.app_access === "active").length || 0,
    paywall: clients?.filter(c => c.access?.app_access === "paywall").length || 0,
    blocked: clients?.filter(c => c.access?.app_access === "blocked").length || 0,
    newThisWeek: clients?.filter(c => 
      differenceInDays(new Date(), new Date(c.created_at)) <= 7
    ).length || 0,
    trialEndingSoon: clients?.filter(c => {
      if (c.access?.app_access !== "trial" || !c.access?.trial_ends_at) return false;
      const daysLeft = differenceInDays(new Date(c.access.trial_ends_at), new Date());
      return daysLeft >= 0 && daysLeft <= 3;
    }).length || 0,
  };

  const getStatusBadge = (access: string) => {
    switch (access) {
      case "trial":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Trial</Badge>;
      case "active":
        return <Badge className="bg-green-500 gap-1"><UserCheck className="h-3 w-3" />Actif</Badge>;
      case "paywall":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1"><AlertTriangle className="h-3 w-3" />Paywall</Badge>;
      case "blocked":
        return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Bloqué</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getTrialStatus = (client: ClientWithDetails) => {
    if (client.access?.app_access !== "trial" || !client.access?.trial_ends_at) {
      return null;
    }
    const daysLeft = differenceInDays(new Date(client.access.trial_ends_at), new Date());
    if (daysLeft < 0) {
      return <span className="text-xs text-destructive font-medium">Expiré</span>;
    }
    if (daysLeft <= 3) {
      return <span className="text-xs text-yellow-600 font-medium">{daysLeft}j restants</span>;
    }
    return <span className="text-xs text-muted-foreground">{daysLeft}j restants</span>;
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredClients?.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredClients?.map(c => c.user_id)));
    }
  };

  const toggleSelect = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const handleBulkAction = (type: typeof actionDialog.type) => {
    if (selectedUsers.size === 0) {
      toast.error("Sélectionnez au moins un utilisateur");
      return;
    }
    setActionDialog({ type, userIds: Array.from(selectedUsers) });
  };

  const confirmAction = () => {
    if (!actionDialog.type) return;
    bulkActionMutation.mutate({
      action: actionDialog.type,
      userIds: actionDialog.userIds,
      days: actionDialog.type === "extend_trial" ? trialDays : undefined,
    });
  };

  const exportCsv = () => {
    if (!filteredClients) return;
    
    const headers = ["Email", "Prénom", "Nom", "Statut", "Inscription", "Fin Trial"];
    const rows = filteredClients.map(c => [
      c.email,
      c.first_name || "",
      c.last_name || "",
      c.access?.app_access || "unknown",
      format(new Date(c.created_at), "yyyy-MM-dd"),
      c.access?.trial_ends_at ? format(new Date(c.access.trial_ends_at), "yyyy-MM-dd") : "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestion Clients</h1>
            <p className="text-muted-foreground mt-1">Gérez vos utilisateurs et leurs accès</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("all")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("trial")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Trial</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.trial}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("active")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Actifs</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("paywall")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Paywall</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.paywall}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("blocked")}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Bloqués</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{stats.blocked}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Cette sem.</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-primary">{stats.newThisWeek}</p>
            </CardContent>
          </Card>
          <Card className={stats.trialEndingSoon > 0 ? "border-yellow-500" : ""}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Expire &lt;3j</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.trialEndingSoon}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">Liste Utilisateurs</TabsTrigger>
            <TabsTrigger value="actions">Actions Groupées</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par nom ou email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppAccess)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous ({stats.total})</SelectItem>
                      <SelectItem value="trial">Trial ({stats.trial})</SelectItem>
                      <SelectItem value="active">Actif ({stats.active})</SelectItem>
                      <SelectItem value="paywall">Paywall ({stats.paywall})</SelectItem>
                      <SelectItem value="blocked">Bloqué ({stats.blocked})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedUsers.size === filteredClients?.length && (filteredClients?.length ?? 0) > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Utilisateur</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Trial</TableHead>
                          <TableHead>Inscription</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClients?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Aucun utilisateur trouvé
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredClients?.map((client) => (
                            <TableRow key={client.user_id} className={selectedUsers.has(client.user_id) ? "bg-muted/50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedUsers.has(client.user_id)}
                                  onCheckedChange={() => toggleSelect(client.user_id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {client.first_name || client.last_name 
                                      ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                                      : "—"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{client.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(client.access?.app_access || "")}</TableCell>
                              <TableCell>{getTrialStatus(client) || "—"}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(client.created_at), "dd MMM yyyy", { locale: fr })}
                                </span>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: "extend_trial", userIds: [client.user_id] })}>
                                      <Clock className="h-4 w-4 mr-2" />
                                      Prolonger trial
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setActionDialog({ type: "grant_access", userIds: [client.user_id] })}>
                                      <Gift className="h-4 w-4 mr-2" />
                                      Accès gratuit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {client.access?.app_access === "blocked" ? (
                                      <DropdownMenuItem onClick={() => setActionDialog({ type: "unblock", userIds: [client.user_id] })}>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Débloquer
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem 
                                        onClick={() => setActionDialog({ type: "block", userIds: [client.user_id] })}
                                        className="text-destructive"
                                      >
                                        <Ban className="h-4 w-4 mr-2" />
                                        Bloquer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Actions Groupées</CardTitle>
                <CardDescription>
                  {selectedUsers.size > 0 
                    ? `${selectedUsers.size} utilisateur(s) sélectionné(s)`
                    : "Sélectionnez des utilisateurs dans la liste pour effectuer des actions groupées"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-24 flex-col gap-2"
                  disabled={selectedUsers.size === 0}
                  onClick={() => handleBulkAction("extend_trial")}
                >
                  <Clock className="h-6 w-6 text-blue-500" />
                  <span>Prolonger Trial</span>
                  <span className="text-xs text-muted-foreground">+15 jours</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col gap-2"
                  disabled={selectedUsers.size === 0}
                  onClick={() => handleBulkAction("grant_access")}
                >
                  <Gift className="h-6 w-6 text-green-500" />
                  <span>Accès Gratuit</span>
                  <span className="text-xs text-muted-foreground">Statut "active"</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col gap-2"
                  disabled={selectedUsers.size === 0}
                  onClick={() => handleBulkAction("unblock")}
                >
                  <UserCheck className="h-6 w-6 text-primary" />
                  <span>Débloquer</span>
                  <span className="text-xs text-muted-foreground">Retour en trial</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex-col gap-2 border-destructive/50 hover:bg-destructive/10"
                  disabled={selectedUsers.size === 0}
                  onClick={() => handleBulkAction("block")}
                >
                  <Ban className="h-6 w-6 text-destructive" />
                  <span className="text-destructive">Bloquer</span>
                  <span className="text-xs text-muted-foreground">Accès révoqué</span>
                </Button>
              </CardContent>
            </Card>

            {/* Quick Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Sélection Rapide</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const trialUsers = clients?.filter(c => c.access?.app_access === "trial") || [];
                    setSelectedUsers(new Set(trialUsers.map(u => u.user_id)));
                    setStatusFilter("trial");
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Tous les trials ({stats.trial})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const expiringUsers = clients?.filter(c => {
                      if (c.access?.app_access !== "trial" || !c.access?.trial_ends_at) return false;
                      const daysLeft = differenceInDays(new Date(c.access.trial_ends_at), new Date());
                      return daysLeft >= 0 && daysLeft <= 3;
                    }) || [];
                    setSelectedUsers(new Set(expiringUsers.map(u => u.user_id)));
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                  Trials expirant (&lt;3j)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const paywallUsers = clients?.filter(c => c.access?.app_access === "paywall") || [];
                    setSelectedUsers(new Set(paywallUsers.map(u => u.user_id)));
                    setStatusFilter("paywall");
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Tous en paywall ({stats.paywall})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUsers(new Set())}
                >
                  Désélectionner tout
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.type !== null} onOpenChange={(open) => !open && setActionDialog({ type: null, userIds: [] })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "extend_trial" && "Prolonger la période d'essai"}
              {actionDialog.type === "grant_access" && "Accorder l'accès gratuit"}
              {actionDialog.type === "block" && "Bloquer l'utilisateur"}
              {actionDialog.type === "unblock" && "Débloquer l'utilisateur"}
            </DialogTitle>
            <DialogDescription>
              Cette action sera appliquée à {actionDialog.userIds.length} utilisateur(s).
            </DialogDescription>
          </DialogHeader>

          {actionDialog.type === "extend_trial" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Durée de prolongation</label>
              <Select value={trialDays.toString()} onValueChange={(v) => setTrialDays(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="15">15 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="60">60 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, userIds: [] })}>
              Annuler
            </Button>
            <Button 
              onClick={confirmAction}
              disabled={bulkActionMutation.isPending}
              variant={actionDialog.type === "block" ? "destructive" : "default"}
            >
              {bulkActionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}