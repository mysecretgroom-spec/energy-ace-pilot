import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import { 
  Calendar, 
  Mail, 
  HardDrive, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SyncHistoryItem {
  id: string;
  sync_type: string;
  status: string;
  events_imported: number;
  events_updated: number;
  events_exported: number;
  events_skipped: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function GoogleAccountSettings() {
  const { user, signInWithGoogle } = useAuth();
  const { checkGoogleConnection, syncCalendar, syncing } = useGoogleCalendarSync();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      setLoading(true);
      const connected = await checkGoogleConnection();
      setIsConnected(connected);
      setLoading(false);

      if (connected) {
        fetchSyncHistory();
      }
    };

    checkConnection();
  }, [checkGoogleConnection]);

  const fetchSyncHistory = async () => {
    if (!user) return;

    try {
      // Using type assertion since google_sync_history was just created
      const { data, error } = await (supabase
        .from("google_sync_history" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10) as any);

      if (error) throw error;
      setSyncHistory(data || []);
    } catch (err) {
      console.error("Error fetching sync history:", err);
    }
  };

  const handleConnect = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error("Erreur de connexion Google");
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    setDisconnecting(true);
    try {
      // Delete tokens from database
      const { error } = await supabase
        .from("google_tokens")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setIsConnected(false);
      setSyncHistory([]);
      toast.success("Compte Google déconnecté");
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    const result = await syncCalendar({ daysAhead: 30, daysBefore: 7 });
    if (result?.success) {
      fetchSyncHistory();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Compte Google
              </CardTitle>
              <CardDescription>
                Synchronisez vos RDV avec Google Calendar
              </CardDescription>
            </div>
            {isConnected ? (
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Non connecté
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              {/* Connected services */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground">Calendar</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                  <Mail className="h-5 w-5 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground">Gmail</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
                  <HardDrive className="h-5 w-5 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground">Drive</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Synchroniser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleConnect} className="w-full gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Connecter Google
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      {showHistory && syncHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique des synchronisations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {syncHistory.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {item.sync_type === "import" ? "Import" : "Export"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM à HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.status === "success" ? (
                      <Badge variant="outline" className="text-green-600 border-green-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {item.events_imported > 0 && `+${item.events_imported}`}
                        {item.events_updated > 0 && ` / ${item.events_updated} màj`}
                        {item.events_exported > 0 && `${item.events_exported} exp.`}
                      </Badge>
                    ) : item.status === "error" ? (
                      <Badge variant="destructive">Erreur</Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        En cours
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
