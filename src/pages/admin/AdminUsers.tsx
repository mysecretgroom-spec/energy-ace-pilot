import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Users,
  AlertTriangle,
  Shield,
  Star,
  ExternalLink,
  Eye,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface AdminUser {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  app_access: string | null;
  is_beta_tester: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
}

type FilterType = "all" | "trial" | "active" | "paywall" | "blocked" | "beta" | "past_due";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_users_overview" as any);
      if (error) throw error;
      return data as AdminUser[];
    },
  });

  const toggleBetaMutation = useMutation({
    mutationFn: async ({ userId, isBeta }: { userId: string; isBeta: boolean }) => {
      const { error } = await supabase.rpc("toggle_beta_tester" as any, {
        p_target_user_id: userId,
        p_is_beta: isBeta,
      });
      if (error) throw error;
    },
    onSuccess: (_, { isBeta }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-overview"] });
      toast.success(isBeta ? "Utilisateur ajouté aux bêta-testeurs" : "Bêta-testeur retiré");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ userId, access }: { userId: string; access: string }) => {
      const { error } = await supabase.rpc("admin_update_access_state" as any, {
        p_target_user_id: userId,
        p_app_access: access,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-overview"] });
      toast.success("Accès mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    switch (filter) {
      case "trial": return user.app_access === "trial";
      case "active": return user.app_access === "active" && !user.is_beta_tester;
      case "paywall": return user.app_access === "paywall";
      case "blocked": return user.app_access === "blocked";
      case "beta": return user.is_beta_tester;
      case "past_due": return user.subscription_status === "past_due";
      default: return true;
    }
  });

  const stats = {
    total: users?.length || 0,
    trial: users?.filter((u) => u.app_access === "trial").length || 0,
    active: users?.filter((u) => u.app_access === "active").length || 0,
    beta: users?.filter((u) => u.is_beta_tester).length || 0,
    pastDue: users?.filter((u) => u.subscription_status === "past_due").length || 0,
    paywall: users?.filter((u) => u.app_access === "paywall").length || 0,
  };

  const getAccessBadge = (user: AdminUser) => {
    if (user.is_beta_tester) {
      return <Badge className="bg-purple-500 text-white"><Star className="h-3 w-3 mr-1" />Bêta</Badge>;
    }
    switch (user.app_access) {
      case "trial": return <Badge variant="secondary">Trial</Badge>;
      case "active": return <Badge className="bg-green-500 text-white">Actif</Badge>;
      case "paywall": return <Badge className="bg-yellow-500 text-white">Paywall</Badge>;
      case "blocked": return <Badge variant="destructive">Bloqué</Badge>;
      default: return <Badge variant="outline">{user.app_access || "—"}</Badge>;
    }
  };

  const getSubBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground text-xs">Aucun</span>;
    switch (status) {
      case "active": return <Badge variant="outline" className="border-green-500 text-green-600">Actif</Badge>;
      case "past_due": return <Badge className="bg-orange-500 text-white">Impayé</Badge>;
      case "canceled": return <Badge variant="outline">Annulé</Badge>;
      case "unpaid": return <Badge variant="destructive">Non payé</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysInfo = (user: AdminUser) => {
    if (user.app_access === "trial" && user.trial_ends_at) {
      const days = differenceInDays(new Date(user.trial_ends_at), new Date());
      if (days < 0) return <span className="text-destructive text-xs">Expiré</span>;
      if (days <= 3) return <span className="text-orange-500 text-xs font-medium">{days}j restants ⚠️</span>;
      return <span className="text-muted-foreground text-xs">{days}j restants</span>;
    }
    if (user.past_due_since) {
      const days = differenceInDays(new Date(), new Date(user.past_due_since));
      return <span className="text-destructive text-xs font-medium">Impayé depuis {days}j</span>;
    }
    return null;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground mt-1">
            Comptes, abonnements, litiges et bêta-testeurs
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("all")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("trial")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.trial}</p>
              <p className="text-xs text-muted-foreground">En Trial</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("active")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("beta")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.beta}</p>
              <p className="text-xs text-muted-foreground">Bêta</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors border-orange-500/30" onClick={() => setFilter("past_due")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.pastDue}</p>
              <p className="text-xs text-muted-foreground">Impayés</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("paywall")}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.paywall}</p>
              <p className="text-xs text-muted-foreground">Paywall</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
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
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous ({stats.total})</SelectItem>
                  <SelectItem value="trial">Trial ({stats.trial})</SelectItem>
                  <SelectItem value="active">Actifs ({stats.active})</SelectItem>
                  <SelectItem value="beta">Bêta ({stats.beta})</SelectItem>
                  <SelectItem value="past_due">Impayés ({stats.pastDue})</SelectItem>
                  <SelectItem value="paywall">Paywall ({stats.paywall})</SelectItem>
                  <SelectItem value="blocked">Bloqués</SelectItem>
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
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Accès</TableHead>
                      <TableHead>Abonnement</TableHead>
                      <TableHead>Info</TableHead>
                      <TableHead>Bêta-testeur</TableHead>
                      <TableHead>Inscrit le</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucun utilisateur trouvé
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredUsers?.map((user) => (
                      <TableRow
                        key={user.user_id}
                        className={
                          user.subscription_status === "past_due"
                            ? "bg-orange-50/50 dark:bg-orange-950/10"
                            : ""
                        }
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.first_name || user.last_name
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                : "—"}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getAccessBadge(user)}</TableCell>
                        <TableCell>{getSubBadge(user.subscription_status)}</TableCell>
                        <TableCell>{getDaysInfo(user)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={user.is_beta_tester}
                            onCheckedChange={(checked) =>
                              toggleBetaMutation.mutate({
                                userId: user.user_id,
                                isBeta: checked,
                              })
                            }
                            disabled={toggleBetaMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(user.created_at), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Détail Utilisateur
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">
                    {selectedUser.first_name || selectedUser.last_name
                      ? `${selectedUser.first_name || ""} ${selectedUser.last_name || ""}`.trim()
                      : "Non renseigné"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inscrit le</p>
                  <p className="font-medium">
                    {format(new Date(selectedUser.created_at), "dd MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-semibold text-sm">Accès & Abonnement</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Statut d'accès</span>
                  {getAccessBadge(selectedUser)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Abonnement Stripe</span>
                  {getSubBadge(selectedUser.subscription_status)}
                </div>
                {selectedUser.trial_ends_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Fin de trial</span>
                    <span className="text-sm font-medium">
                      {format(new Date(selectedUser.trial_ends_at), "dd MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                )}
                {selectedUser.current_period_end && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Fin de période</span>
                    <span className="text-sm font-medium">
                      {format(new Date(selectedUser.current_period_end), "dd MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                )}
                {selectedUser.past_due_since && (
                  <div className="flex items-center justify-between text-orange-600">
                    <span className="text-sm flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Impayé depuis
                    </span>
                    <span className="text-sm font-bold">
                      {format(new Date(selectedUser.past_due_since), "dd MMM yyyy", { locale: fr })}
                      {" "}({differenceInDays(new Date(), new Date(selectedUser.past_due_since))}j)
                    </span>
                  </div>
                )}
                {selectedUser.stripe_customer_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Stripe Customer</span>
                    <a
                      href={`https://dashboard.stripe.com/customers/${selectedUser.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-primary flex items-center gap-1 hover:underline"
                    >
                      {selectedUser.stripe_customer_id.slice(0, 18)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <h4 className="font-semibold text-sm">Actions Admin</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Bêta-testeur</p>
                    <p className="text-xs text-muted-foreground">Accès gratuit permanent</p>
                  </div>
                  <Switch
                    checked={selectedUser.is_beta_tester}
                    onCheckedChange={(checked) => {
                      toggleBetaMutation.mutate({
                        userId: selectedUser.user_id,
                        isBeta: checked,
                      });
                      setSelectedUser({ ...selectedUser, is_beta_tester: checked });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Modifier l'accès</p>
                    <p className="text-xs text-muted-foreground">Changer le statut manuellement</p>
                  </div>
                  <Select
                    value={selectedUser.app_access || "trial"}
                    onValueChange={(v) => {
                      updateAccessMutation.mutate({
                        userId: selectedUser.user_id,
                        access: v,
                      });
                      setSelectedUser({ ...selectedUser, app_access: v });
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="paywall">Paywall</SelectItem>
                      <SelectItem value="blocked">Bloqué</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
