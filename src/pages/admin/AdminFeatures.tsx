import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, ThumbsUp, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type FeatureStatus = "pending" | "under_review" | "planned" | "in_progress" | "completed" | "rejected";

interface FeatureRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  created_at: string;
  user?: SaasUser;
}

interface SaasUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function AdminFeatures() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeatureStatus | "all">("all");
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);

  const { data: features, isLoading } = useQuery({
    queryKey: ["admin-feature-requests"],
    queryFn: async () => {
      const { data: featuresData, error } = await supabase.rpc("get_all_feature_requests" as any);

      if (error) throw error;

      // Get user info
      const { data: users } = await supabase.rpc("get_saas_users" as any);

      return (featuresData as FeatureRequest[])?.map((feature) => ({
        ...feature,
        user: (users as SaasUser[])?.find((u) => u.user_id === feature.user_id),
      }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: FeatureStatus) => {
      const { error } = await supabase.rpc("update_feature_status" as any, {
        p_feature_id: selectedFeature?.id,
        p_status: newStatus
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-requests"] });
      toast.success("Statut mis à jour");
    },
  });

  const filteredFeatures = features?.filter((feature) => {
    const matchesSearch = 
      feature.title?.toLowerCase().includes(search.toLowerCase()) ||
      feature.description?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || feature.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">En attente</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500">En revue</Badge>;
      case "planned":
        return <Badge className="bg-purple-500">Planifié</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500">En cours</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Terminé</Badge>;
      case "rejected":
        return <Badge variant="destructive">Refusé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Demandes d'Amélioration</h1>
          <p className="text-muted-foreground mt-1">Gérez les feature requests</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="under_review">En revue</SelectItem>
                  <SelectItem value="planned">Planifié</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="rejected">Refusé</SelectItem>
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
                    <TableHead>Votes</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeatures?.map((feature) => (
                    <TableRow key={feature.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold">{feature.votes}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {feature.title}
                      </TableCell>
                      <TableCell>{feature.user?.email}</TableCell>
                      <TableCell>
                        {format(new Date(feature.created_at), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{getStatusBadge(feature.status)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedFeature(feature)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature Detail Dialog */}
      <Dialog open={!!selectedFeature} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedFeature?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" />
                <span className="font-bold">{selectedFeature?.votes} votes</span>
              </div>
              <Select 
                value={selectedFeature?.status} 
                onValueChange={(v) => updateStatusMutation.mutate(v as FeatureStatus)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="under_review">En revue</SelectItem>
                  <SelectItem value="planned">Planifié</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="rejected">Refusé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              Par {selectedFeature?.user?.email} le{" "}
              {selectedFeature?.created_at && format(new Date(selectedFeature.created_at), "dd MMMM yyyy", { locale: fr })}
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {selectedFeature?.description || "Pas de description"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
