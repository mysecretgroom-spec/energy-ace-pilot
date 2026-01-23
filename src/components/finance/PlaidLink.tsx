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
  Plus,
  Loader2,
  CreditCard,
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlaidAccount {
  id: string;
  item_id: string;
  institution_name: string | null;
  created_at: string;
}

interface PlaidLinkProps {
  onTransactionsImported?: () => void;
}

export function PlaidLink({ onTransactionsImported }: PlaidLinkProps) {
  const { user, session } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [disconnectItemId, setDisconnectItemId] = useState<string | null>(null);
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, string>>({});

  // Fetch accounts and sync history
  useEffect(() => {
    if (!user || !session?.access_token) return;

    const fetchAccounts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "get_accounts" }),
          }
        );

        const data = await response.json();
        if (data.accounts) {
          setAccounts(data.accounts);
        }

        // Get last sync times
        const { data: syncs } = await supabase
          .from("plaid_syncs")
          .select("plaid_item_id, synced_at")
          .eq("user_id", user.id)
          .order("synced_at", { ascending: false });

        if (syncs) {
          const syncMap: Record<string, string> = {};
          for (const sync of syncs) {
            if (sync.plaid_item_id && !syncMap[sync.plaid_item_id]) {
              syncMap[sync.plaid_item_id] = sync.synced_at;
            }
          }
          setLastSyncTimes(syncMap);
        }
      } catch (error) {
        console.error("Error fetching accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, [user, session]);

  // Get link token for connecting new account
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
        return data.link_token;
      } else {
        toast.error(data.error || "Erreur lors de la création du lien");
        return null;
      }
    } catch (error) {
      console.error("Error getting link token:", error);
      toast.error("Erreur de connexion à Plaid");
      return null;
    }
  };

  // Handle successful Plaid Link
  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      if (!session?.access_token) return;

      setSyncingAll(true);
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
              institution_name: metadata?.institution?.name || null,
            }),
          }
        );

        const exchangeData = await exchangeResponse.json();
        if (!exchangeData.success) {
          throw new Error(exchangeData.error || "Échec de l'échange de token");
        }

        // Refresh accounts list
        const accountsResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "get_accounts" }),
          }
        );

        const accountsData = await accountsResponse.json();
        if (accountsData.accounts) {
          setAccounts(accountsData.accounts);
        }

        toast.success("Compte bancaire connecté !");
        setLinkToken(null);
      } catch (error) {
        console.error("Error exchanging token:", error);
        toast.error("Erreur lors de la connexion du compte");
      } finally {
        setSyncingAll(false);
      }
    },
    [session]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      setLinkToken(null);
    },
  });

  // Add new account
  const handleAddAccount = async () => {
    const token = await getLinkToken();
    if (token) {
      // Token is set, usePlaidLink will update and we can open
      setTimeout(() => {
        if (ready) open();
      }, 100);
    }
  };

  // Effect to open Plaid when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  // Sync single account
  const syncAccount = async (itemId: string) => {
    if (!session?.access_token || !user) return;

    setIsSyncing(itemId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "sync_item", item_id: itemId }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Import transactions as frais
      let importedCount = 0;
      for (const tx of data.transactions || []) {
        if (tx.amount > 0 && !tx.pending) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("frais")
            .select("id")
            .eq("user_id", user.id)
            .ilike("description", `%${tx.id}%`)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase.from("frais").insert({
              user_id: user.id,
              montant: tx.amount,
              date_frais: tx.date,
              categorie: tx.category as any,
              description: tx.description || tx.merchant || "Import Plaid",
              ocr_data: {
                plaid_transaction_id: tx.id,
                merchant: tx.merchant,
                institution: tx.institution,
              },
            });

            if (!error) importedCount++;
          }
        }
      }

      // Update last sync time locally
      const account = accounts.find((a) => a.item_id === itemId);
      if (account) {
        setLastSyncTimes((prev) => ({
          ...prev,
          [account.id]: new Date().toISOString(),
        }));
      }

      if (importedCount > 0) {
        toast.success(`${importedCount} transactions importées`);
        onTransactionsImported?.();
      } else {
        toast.info("Aucune nouvelle transaction");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error(error instanceof Error ? error.message : "Erreur de sync");
    } finally {
      setIsSyncing(null);
    }
  };

  // Sync all accounts
  const syncAllAccounts = async () => {
    if (!session?.access_token || !user) return;

    setSyncingAll(true);
    try {
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
      for (const tx of data.transactions || []) {
        if (tx.amount > 0 && !tx.pending) {
          const { data: existing } = await supabase
            .from("frais")
            .select("id")
            .eq("user_id", user.id)
            .ilike("description", `%${tx.id}%`)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase.from("frais").insert({
              user_id: user.id,
              montant: tx.amount,
              date_frais: tx.date,
              categorie: tx.category as any,
              description: tx.description || tx.merchant || "Import Plaid",
              ocr_data: {
                plaid_transaction_id: tx.id,
                merchant: tx.merchant,
                institution: tx.institution,
              },
            });

            if (!error) importedCount++;
          }
        }
      }

      // Record sync
      await supabase.from("plaid_syncs").insert({
        user_id: user.id,
        transactions_count: importedCount,
        sync_type: "manual",
      });

      if (importedCount > 0) {
        toast.success(`${importedCount} transactions importées`);
        onTransactionsImported?.();
      } else {
        toast.info("Aucune nouvelle transaction");
      }
    } catch (error) {
      console.error("Error syncing all:", error);
      toast.error(error instanceof Error ? error.message : "Erreur de sync");
    } finally {
      setSyncingAll(false);
    }
  };

  // Disconnect account
  const handleDisconnect = async () => {
    if (!session?.access_token || !disconnectItemId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "disconnect", item_id: disconnectItemId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setAccounts((prev) => prev.filter((a) => a.item_id !== disconnectItemId));
        toast.success("Compte déconnecté");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setDisconnectItemId(null);
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Comptes bancaires
              {accounts.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {accounts.length}
                </Badge>
              )}
            </CardTitle>
            {accounts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={syncAllAccounts}
                disabled={syncingAll}
                className="h-8 gap-1"
              >
                {syncingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Tout sync
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                Connectez vos comptes bancaires pour importer automatiquement vos
                transactions professionnelles.
              </p>
              <Button className="w-full gap-2" onClick={handleAddAccount} disabled={syncingAll}>
                {syncingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                Connecter ma banque
              </Button>
            </>
          ) : (
            <>
              {/* Account list */}
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {account.institution_name || "Compte bancaire"}
                        </p>
                        {lastSyncTimes[account.id] && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(lastSyncTimes[account.id]).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => syncAccount(account.item_id)}
                        disabled={isSyncing === account.item_id || syncingAll}
                      >
                        {isSyncing === account.item_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDisconnectItemId(account.item_id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Unplug className="h-4 w-4 mr-2" />
                            Déconnecter
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add another account */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={handleAddAccount}
                disabled={syncingAll}
              >
                <Plus className="h-4 w-4" />
                Ajouter un compte
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                Webhooks actifs • Mises à jour automatiques
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation */}
      <AlertDialog open={!!disconnectItemId} onOpenChange={() => setDisconnectItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les transactions déjà importées seront conservées. Vous pourrez
              reconnecter ce compte à tout moment.
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
