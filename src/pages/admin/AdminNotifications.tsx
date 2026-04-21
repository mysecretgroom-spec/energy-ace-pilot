import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNotificationStatus } from "@/lib/labels";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Send, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap,
  Users,
  User,
  History,
  FileText,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type AudienceType = "all" | "status" | "user";
type StatusFilter = "trial" | "active" | "paywall" | "blocked";

interface NotificationLog {
  id: string;
  created_at: string;
  title: string;
  message: string;
  audience: string;
  status: string;
}

interface SaasUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

// Predefined notification templates
const notificationTemplates = [
  {
    id: "trial_reminder",
    name: "Rappel fin de trial",
    icon: "🕐",
    audience: "status" as AudienceType,
    statusFilter: "trial" as StatusFilter,
    title: "Votre essai se termine bientôt",
    message: "Il ne vous reste que quelques jours pour profiter de toutes les fonctionnalités. Abonnez-vous maintenant pour continuer !",
  },
  {
    id: "paywall_recovery",
    name: "Récupération paywall",
    icon: "💳",
    audience: "status" as AudienceType,
    statusFilter: "paywall" as StatusFilter,
    title: "Reprenez votre abonnement",
    message: "Votre période d'essai est terminée. Abonnez-vous dès maintenant pour retrouver l'accès à toutes vos données !",
  },
  {
    id: "new_feature",
    name: "Nouvelle fonctionnalité",
    icon: "🚀",
    audience: "all" as AudienceType,
    statusFilter: null,
    title: "Nouvelle fonctionnalité disponible",
    message: "Découvrez notre dernière mise à jour ! Connectez-vous pour en profiter.",
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: "🔧",
    audience: "all" as AudienceType,
    statusFilter: null,
    title: "Maintenance prévue",
    message: "Une maintenance est prévue. L'application sera temporairement indisponible.",
  },
  {
    id: "promo",
    name: "Offre promotionnelle",
    icon: "🎉",
    audience: "status" as AudienceType,
    statusFilter: "trial" as StatusFilter,
    title: "Offre spéciale pour vous !",
    message: "Profitez de -20% sur votre premier mois d'abonnement. Offre limitée !",
  },
  {
    id: "welcome",
    name: "Bienvenue",
    icon: "👋",
    audience: "user" as AudienceType,
    statusFilter: null,
    title: "Bienvenue sur Débale Pro !",
    message: "Nous sommes ravis de vous accueillir. Découvrez toutes les fonctionnalités de l'application.",
  },
];

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["admin-notification-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saas_notification_logs");
      if (error) throw error;
      return (data as NotificationLog[]) || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users-for-notif"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saas_users");
      if (error) throw error;
      return (data as SaasUser[]) || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-notif-stats"],
    queryFn: async () => {
      const { data: accessStates } = await supabase.rpc("get_all_saas_access_states");
      const counts = {
        all: (accessStates as any[])?.length || 0,
        trial: 0,
        active: 0,
        paywall: 0,
        blocked: 0,
      };
      (accessStates as any[])?.forEach((state) => {
        if (counts[state.app_access as keyof typeof counts] !== undefined) {
          counts[state.app_access as keyof typeof counts]++;
        }
      });
      return counts;
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
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["admin-notification-logs"] });
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const applyTemplate = (templateId: string) => {
    const template = notificationTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setTitle(template.title);
    setMessage(template.message);
    setAudienceType(template.audience);
    if (template.statusFilter) {
      setStatusFilter(template.statusFilter);
    }
    toast.success(`Template "${template.name}" appliqué`);
  };

  const getAudienceCount = () => {
    if (!stats) return 0;
    if (audienceType === "all") return stats.all;
    if (audienceType === "user") return targetUserId ? 1 : 0;
    return stats[statusFilter] || 0;
  };

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

  const replayNotification = (log: NotificationLog) => {
    setTitle(log.title);
    setMessage(log.message);
    toast.info("Notification copiée - modifiez et envoyez");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Notifications Push</h1>
          <p className="text-muted-foreground mt-1">Envoyez des notifications ciblées à vos utilisateurs</p>
        </div>

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose" className="gap-2">
              <Send className="h-4 w-4" />
              Composer
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Composer */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Nouvelle Notification</CardTitle>
                  <CardDescription>Composez et envoyez une notification push</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Audience Selection */}
                  <div className="space-y-3">
                    <Label>Audience cible</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={audienceType === "all" ? "default" : "outline"}
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => setAudienceType("all")}
                      >
                        <Users className="h-5 w-5" />
                        <span className="text-xs">Tous</span>
                        <span className="text-xs text-muted-foreground">{stats?.all || 0}</span>
                      </Button>
                      <Button
                        type="button"
                        variant={audienceType === "status" ? "default" : "outline"}
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => setAudienceType("status")}
                      >
                        <Clock className="h-5 w-5" />
                        <span className="text-xs">Par statut</span>
                      </Button>
                      <Button
                        type="button"
                        variant={audienceType === "user" ? "default" : "outline"}
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => setAudienceType("user")}
                      >
                        <User className="h-5 w-5" />
                        <span className="text-xs">Utilisateur</span>
                      </Button>
                    </div>
                  </div>

                  {audienceType === "status" && (
                    <div className="space-y-2">
                      <Label>Statut d'accès</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["trial", "active", "paywall", "blocked"] as const).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            variant={statusFilter === status ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(status)}
                          >
                            {status} ({stats?.[status] || 0})
                          </Button>
                        ))}
                      </div>
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
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground text-right">{title.length}/50</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      placeholder="Contenu de la notification"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground text-right">{message.length}/200</p>
                  </div>
                </CardContent>
              </Card>

              {/* Preview & Send */}
              <Card>
                <CardHeader>
                  <CardTitle>Prévisualisation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mobile Preview */}
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <span className="text-primary-foreground text-xs font-bold">DP</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {title || "Titre de la notification"}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {message || "Contenu du message..."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">maintenant</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destinataires</span>
                      <span className="font-medium">{getAudienceCount()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Audience</span>
                      <Badge variant="outline">
                        {audienceType === "all" ? "Tous" : audienceType === "status" ? statusFilter : "1 utilisateur"}
                      </Badge>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending || !title || !message || getAudienceCount() === 0}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Envoyer à {getAudienceCount()} utilisateur(s)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Templates de Notification</CardTitle>
                <CardDescription>Utilisez un template prédéfini pour gagner du temps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notificationTemplates.map((template) => (
                    <Card 
                      key={template.id} 
                      className={`cursor-pointer transition-all hover:border-primary ${selectedTemplate === template.id ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => applyTemplate(template.id)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{template.icon}</span>
                          <div className="flex-1">
                            <p className="font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.message}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {template.audience === "all" ? "Tous" : template.audience === "status" ? template.statusFilter : "Individuel"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des Notifications</CardTitle>
                <CardDescription>Les 50 dernières notifications envoyées</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : logs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune notification envoyée
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium max-w-[150px] truncate">{log.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{log.message}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.audience}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              <span className="text-sm">{formatNotificationStatus(log.status)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => replayNotification(log)}
                              title="Réutiliser"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}