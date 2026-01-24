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

type SubStatus = "trial" | "active" | "past_due" | "canceled" | "unpaid" | "blocked" | "incomplete" | "all";

export default function AdminSubscriptions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubStatus>("all");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("updated_at", { ascending: false })
        .schema("saas" as any);

      if (error) throw error;

      // Get user info
      const userIds = subs?.map((s: any) => s.user_id) || [];
      const { data: users } = await supabase
        .from("users")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds)
        .schema("saas" as any);

      return subs?.map((sub: any) => ({
        ...sub,
        user: users?.find((u: any) => u.user_id === sub.user_id),
      }));
    },
  });

  const filteredSubscriptions = subscriptions?.filter((sub: any) => {
    const matchesSearch = 
      sub.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      sub.stripe_customer_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge variant="secondary">Trial</Badge>;
      case "active":
        return <Badge className="bg-green-500">Actif</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500">Impayé</Badge>;
      case "canceled":
        return <Badge variant="outline">Annulé</Badge>;
      case "unpaid":
        return <Badge variant="destructive">Non payé</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqué</Badge>;
      case "incomplete":
        return <Badge variant="outline">Incomplet</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Abonnements</h1>
          <p className="text-muted-foreground mt-1">Gérez les abonnements Stripe</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par email ou ID Stripe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SubStatus)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="past_due">Impayé</SelectItem>
                  <SelectItem value="canceled">Annulé</SelectItem>
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
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Stripe Customer</TableHead>
                    <TableHead>Fin période</TableHead>
                    <TableHead>Impayé depuis</TableHead>
                    <TableHead>Mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions?.map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {sub.user?.first_name} {sub.user?.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {sub.user?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {sub.stripe_customer_id || "-"}
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end 
                          ? format(new Date(sub.current_period_end), "dd MMM yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {sub.past_due_since 
                          ? format(new Date(sub.past_due_since), "dd MMM yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(sub.updated_at), "dd MMM HH:mm", { locale: fr })}
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
