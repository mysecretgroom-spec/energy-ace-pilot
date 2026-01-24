import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type AppAccess = "trial" | "active" | "paywall" | "blocked" | "all";

export default function AdminClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppAccess>("all");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("*")
        .schema("saas" as any);

      if (usersError) throw usersError;

      const { data: accessStates } = await supabase
        .from("access_state")
        .select("*")
        .schema("saas" as any);

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("*")
        .schema("saas" as any);

      return users?.map((user: any) => ({
        ...user,
        access: accessStates?.find((a: any) => a.user_id === user.user_id),
        subscription: subscriptions?.find((s: any) => s.user_id === user.user_id),
      }));
    },
  });

  const filteredClients = clients?.filter((client: any) => {
    const matchesSearch = 
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      client.last_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || client.access?.app_access === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (access: string) => {
    switch (access) {
      case "trial":
        return <Badge variant="secondary">Trial</Badge>;
      case "active":
        return <Badge className="bg-green-500">Actif</Badge>;
      case "paywall":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Paywall</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqué</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">Gérez vos utilisateurs</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppAccess)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="paywall">Paywall</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Fin Trial</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead>Inscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client: any) => (
                    <TableRow key={client.user_id}>
                      <TableCell className="font-medium">
                        {client.first_name} {client.last_name}
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>{client.sector || "-"}</TableCell>
                      <TableCell>{getStatusBadge(client.access?.app_access)}</TableCell>
                      <TableCell>
                        {client.access?.trial_ends_at 
                          ? format(new Date(client.access.trial_ends_at), "dd MMM yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.subscription?.status || "trial"}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(client.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
