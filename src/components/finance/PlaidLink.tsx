import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Building2,
  RefreshCw,
  Unplug,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlaidLinkProps {
  onTransactionsImported?: () => void;
}

export function PlaidLink({ onTransactionsImported }: PlaidLinkProps) {
  const { user, session } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const [canSyncNow, setCanSyncNow] = useState(false);

  // Check connection status and last sync
  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      setIsLoading(true);
      try {
        // Check if user has a Plaid connection
        const { data: plaidItem } = await supabase
          .from("plaid_items")
          .select("id, created_at, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        setIsConnected(!!plaidItem);

        // Check last sync time from plaid_syncs table
        const { data: lastSyncData } = await supabase
          .from("plaid_syncs")
          .select("synced_at")
          .eq("user_id", user.id)
          .order("synced_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSyncData) {
          setLastSync(lastSyncData.synced_at);
          
          // Calculate if user can sync now (limit: 2 syncs per day at 12h and midnight)
          const lastSyncDate = new Date(lastSyncData.synced_at);
          const now = new Date();
          
          // Get today's sync windows: midnight (00:00) and noon (12:00)
          const todayMidnight = new Date(now);
          todayMidnight.setHours(0, 0, 0, 0);
          
          const todayNoon = new Date(now);
          todayNoon.setHours(12, 0, 0, 0);
          
          // Count syncs today
          const { count } = await supabase
            .from("plaid_syncs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("synced_at", todayMidnight.toISOString());

          const syncsTodayCount = count || 0;

          // Can sync if: less than 2 syncs today AND current time is after a sync window
          // Sync windows: 00:00-00:30 and 12:00-12:30
          const isInMidnightWindow = now.getHours() === 0 && now.getMinutes() < 30;
          const isInNoonWindow = now.getHours() === 12 && now.getMinutes() < 30;
          const isInSyncWindow = isInMidnightWindow || isInNoonWindow;

          // Check if last sync was before current window
          let canSync = false;
          if (syncsTodayCount < 2) {
            if (isInSyncWindow) {
              // In a sync window, check if we haven't synced in this window yet
              if (now.getHours() === 0 || now.getHours() === 12) {
                const windowStart = new Date(now);
                windowStart.setMinutes(0, 0, 0);
                canSync = lastSyncDate < windowStart;
              }
            } else {
              // Outside sync window, can't sync now
              canSync = false;
            }
          }

          setCanSyncNow(canSync || syncsTodayCount === 0);

          // Calculate next sync time
          if (now.getHours() < 12) {
            setNextSyncTime("12:00");
          } else {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            setNextSyncTime("00:00 demain");
          }
        } else {
          // No sync yet, can sync anytime
          setCanSyncNow(true);
        }
      } catch (error) {
        console.error("Error checking Plaid status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [user]);

  // Get link token for connecting
  const getLinkToken = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "create_link_token" }),
        }
      );

      const data = await response.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        toast.error(data.error || "Erreur lors de la création du lien");
      }
    } catch (error) {
      console.error("Error getting link token:", error);
      toast.error("Erreur de connexion à Plaid");
    }
  };

  // Handle successful Plaid Link
  const onSuccess = useCallback(
    async (publicToken: string) => {
      if (!session?.access_token) return;

      setIsSyncing(true);
      try {
        // Exchange public token
        const exchangeResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: "exchange_token",
              public_token: publicToken,
            }),
          }
        );

        const exchangeData = await exchangeResponse.json();
        if (!exchangeData.success) {
          throw new Error(exchangeData.error || "Échec de l'échange de token");
        }

        setIsConnected(true);
        toast.success("Compte bancaire connecté !");

        // Immediately sync transactions
        await syncTransactions();
      } catch (error) {
        console.error("Error exchanging token:", error);
        toast.error("Erreur lors de la connexion du compte");
      } finally {
        setIsSyncing(false);
      }
    },
    [session]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      // User exited without completing
    },
  });

  // Sync transactions
  const syncTransactions = async () => {
    if (!session?.access_token || !user) return;

    setIsSyncing(true);
    try {
      // Get transactions from Plaid
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "get_transactions" }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Import transactions as frais
      let importedCount = 0;
      for (const tx of data.transactions) {
        // Only import expenses (negative amounts in bank)
        if (tx.amount > 0 && !tx.pending) {
          const { error } = await supabase.from("frais").insert({
            user_id: user.id,
            montant: tx.amount,
            date_frais: tx.date,
            categorie: tx.category as any,
            description: tx.description || tx.merchant || "Import Plaid",
          });

          if (!error) {
            importedCount++;
          }
        }
      }

      // Record sync
      await supabase.from("plaid_syncs").insert({
        user_id: user.id,
        transactions_count: importedCount,
      });

      setLastSync(new Date().toISOString());
      setCanSyncNow(false);

      if (importedCount > 0) {
        toast.success(`${importedCount} transactions importées`);
        onTransactionsImported?.();
      } else {
        toast.info("Aucune nouvelle transaction à importer");
      }
    } catch (error) {
      console.error("Error syncing transactions:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur de synchronisation"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "disconnect" }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setIsConnected(false);
        setLinkToken(null);
        toast.success("Compte bancaire déconnecté");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setDisconnectDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Connexion bancaire
            {isConnected && (
              <Badge variant="outline" className="ml-auto text-green-600 border-green-200 bg-green-50">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isConnected ? (
            <>
              {/* Sync status */}
              <div className="text-xs text-muted-foreground space-y-1">
                {lastSync && (
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Dernière sync: {new Date(lastSync).toLocaleString("fr-FR")}
                  </p>
                )}
                {nextSyncTime && !canSyncNow && (
                  <p className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Prochaine sync disponible: {nextSyncTime}
                  </p>
                )}
                <p className="text-xs opacity-75">
                  Limite: 2 syncs/jour (12h et minuit)
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={syncTransactions}
                  disabled={isSyncing || !canSyncNow}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isSyncing ? "Sync..." : "Synchroniser"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDisconnectDialogOpen(true)}
                >
                  <Unplug className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Connectez votre compte bancaire pour importer automatiquement vos
                transactions professionnelles.
              </p>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  if (linkToken) {
                    open();
                  } else {
                    getLinkToken().then(() => {
                      // Will open when ready
                    });
                  }
                }}
                disabled={!ready && !!linkToken}
              >
                <Building2 className="h-4 w-4" />
                Connecter ma banque
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Open Plaid Link when token is ready */}
      {linkToken && ready && !isConnected && (
        <div className="hidden">
          {/* Auto-open handled by button click */}
        </div>
      )}

      {/* Disconnect confirmation */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter le compte bancaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les transactions déjà importées seront conservées. Vous pourrez
              reconnecter un compte à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive hover:bg-destructive/90"
            >
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
