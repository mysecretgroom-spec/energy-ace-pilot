import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { Send, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type AudienceType = "all" | "status" | "user";
type StatusFilter = "trial" | "active" | "paywall" | "blocked";

interface NotificationLog {
  id: string;
  created_at: string;
  title: string;
  audience: string;
  status: string;
}

interface SaasUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin-notification-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saas_notification_logs" as any);

      if (error) throw error;
      return data as NotificationLog[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users-for-notif"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saas_users" as any);

      if (error) throw error;
      return data as SaasUser[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        audienceType,
        title,
        message,
      };

      if (audienceType === "status") {
        payload.statusFilter = statusFilter;
      } else if (audienceType === "user") {
        payload.targetUserId = targetUserId;
      }

      const { data, error } = await supabase.functions.invoke("saas-send-onesignal", {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Notification envoyée à ${data.recipients || 0} destinataire(s)`);
      setTitle("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-notification-logs"] });
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">Envoyez des notifications push via OneSignal</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Composer */}
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle Notification</CardTitle>
              <CardDescription>Composez et envoyez une notification push</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audienceType} onValueChange={(v) => setAudienceType(v as AudienceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    <SelectItem value="status">Par statut</SelectItem>
                    <SelectItem value="user">Utilisateur spécifique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {audienceType === "status" && (
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger>
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
              )}

              {audienceType === "user" && (
                <div className="space-y-2">
                  <Label>Utilisateur</Label>
                  <Select value={targetUserId} onValueChange={setTargetUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.email} ({user.first_name} {user.last_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Titre</Label>
                <Input
                  placeholder="Titre de la notification"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Contenu de la notification"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || !title || !message}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer
              </Button>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions Rapides</CardTitle>
              <CardDescription>Notifications pré-configurées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  setAudienceType("status");
                  setStatusFilter("trial");
                  setTitle("Votre essai se termine bientôt");
                  setMessage("N'attendez pas la fin de votre période d'essai pour vous abonner !");
                }}
              >
                🕐 Relance Trial
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  setAudienceType("status");
                  setStatusFilter("paywall");
                  setTitle("Reprenez votre abonnement");
                  setMessage("Votre période d'essai est terminée. Abonnez-vous pour continuer !");
                }}
              >
                💳 Relance Paywall
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  setAudienceType("all");
                  setTitle("Nouvelle fonctionnalité");
                  setMessage("Découvrez notre dernière mise à jour !");
                }}
              >
                🚀 Annonce Générale
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium">{log.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.audience}</Badge>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {log.status}
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
