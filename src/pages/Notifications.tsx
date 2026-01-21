import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Bell,
  Calendar,
  User,
  Euro,
  Target,
  FileText,
  CheckCheck,
  Trash2,
  Loader2,
  BellOff
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type NotificationType = 'rappel_rdv' | 'relance_client' | 'commission_paye' | 'objectif_atteint' | 'nouveau_rdv' | 'vente_signee' | 'installation_prevue' | 'autre';

interface Notification {
  id: string;
  type: NotificationType;
  titre: string;
  message: string;
  lue: boolean;
  date_lecture: string | null;
  created_at: string;
  client_id: string | null;
  rdv_id: string | null;
  vente_id: string | null;
}

const typeConfig: Record<NotificationType, { icon: React.ReactNode; color: string }> = {
  rappel_rdv: { icon: <Calendar className="h-5 w-5" />, color: "bg-blue-500" },
  relance_client: { icon: <User className="h-5 w-5" />, color: "bg-amber-500" },
  commission_paye: { icon: <Euro className="h-5 w-5" />, color: "bg-green-500" },
  objectif_atteint: { icon: <Target className="h-5 w-5" />, color: "bg-purple-500" },
  nouveau_rdv: { icon: <Calendar className="h-5 w-5" />, color: "bg-primary" },
  vente_signee: { icon: <FileText className="h-5 w-5" />, color: "bg-emerald-500" },
  installation_prevue: { icon: <Calendar className="h-5 w-5" />, color: "bg-cyan-500" },
  autre: { icon: <Bell className="h-5 w-5" />, color: "bg-muted-foreground" }
};

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data as Notification[]);
    } catch (error) {
      console.error("Erreur chargement notifications:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true, date_lecture: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, lue: true } : n)
      );
    } catch (error) {
      console.error("Erreur marquage notification:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ lue: true, date_lecture: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("lue", false);

      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
      toast.success("Toutes les notifications marquées comme lues");
    } catch (error) {
      console.error("Erreur marquage notifications:", error);
      toast.error("Erreur lors du marquage");
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success("Notification supprimée");
    } catch (error) {
      console.error("Erreur suppression notification:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const unreadCount = notifications.filter(n => !n.lue).length;

  return (
    <MobileLayout title="Notifications" showBackButton>
      <div className="p-4 space-y-4 pb-24">
        {/* Header actions */}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <Badge variant="secondary">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Tout marquer comme lu
            </Button>
          </div>
        )}

        {/* Liste des notifications */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BellOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune notification</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vous recevrez des alertes pour vos RDV et ventes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const config = typeConfig[notification.type];
              return (
                <Card 
                  key={notification.id}
                  className={`transition-colors ${!notification.lue ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => !notification.lue && markAsRead(notification.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`h-10 w-10 rounded-full ${config.color} text-white flex items-center justify-center flex-shrink-0`}>
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`font-medium ${!notification.lue ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.titre}
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { 
                            addSuffix: true, 
                            locale: fr 
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.lue && (
                      <div className="absolute top-4 left-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default Notifications;
