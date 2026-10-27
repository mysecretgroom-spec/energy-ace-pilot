import { callGoogleAccount } from "@/lib/googleConnection";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GmailSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<{
    messageId: string;
    subject: string;
    sender: string;
    status: "imported" | "updated" | "skipped" | "error";
    error?: string;
    rdvId?: string;
  }>;
  message?: string;
}

export interface GmailSyncOptions {
  days?: number;
  fromDate?: string; // format: YYYY/MM/DD
  toDate?: string;   // format: YYYY/MM/DD
}

export function useGmailSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<GmailSyncResult | null>(null);

  const checkGoogleConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const status = await callGoogleAccount({ action: "status" });
      if (status.connected) return true;
      // Preserve legacy Gmail/Agenda accounts until they explicitly reconnect.
      const { data, error } = await supabase.from("google_tokens").select("id").eq("user_id", session.user.id).maybeSingle();
      return !!data && !error;
    } catch {
      return false;
    }
  }, []);

  const checkAuthorizedEmails = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase
        .from("emails_autorises")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("actif", true)
        .limit(1);

      return !!data?.length && !error;
    } catch {
      return false;
    }
  }, []);

  const syncGmail = useCallback(async (options?: GmailSyncOptions): Promise<GmailSyncResult | null> => {
    setSyncing(true);
    setLastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Non connecté");
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-gmail-rdv`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            days: options?.days,
            fromDate: options?.fromDate,
            toDate: options?.toDate
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "GOOGLE_NOT_CONNECTED") {
          toast.error("Compte Google non connecté", {
            description: "Connectez votre compte Google dans les paramètres"
          });
        } else if (result.code === "NO_AUTHORIZED_EMAILS") {
          toast.error("Aucun email autorisé", {
            description: "Configurez les emails autorisés dans les paramètres"
          });
        } else {
          toast.error("Erreur de synchronisation", {
            description: result.error || "Une erreur est survenue"
          });
        }
        return null;
      }

      setLastResult(result);

      // Show appropriate toast
      if (result.imported === 0 && result.updated === 0 && result.errors === 0) {
        toast.info("Aucun nouveau RDV", {
          description: result.message || "Pas de nouveaux emails à importer"
        });
      } else if (result.errors > 0 && result.imported === 0 && result.updated === 0) {
        toast.error(`${result.errors} erreur(s)`, {
          description: "Vérifiez le format des emails"
        });
      } else {
        const parts = [];
        if (result.imported > 0) parts.push(`${result.imported} importé(s)`);
        if (result.updated > 0) parts.push(`${result.updated} mis à jour`);
        if (result.errors > 0) parts.push(`${result.errors} erreur(s)`);
        
        // Silent sync success
      }

      return result;

    } catch (error) {
      console.error("Gmail sync error:", error);
      toast.error("Erreur de synchronisation");
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    syncing,
    lastResult,
    syncGmail,
    checkGoogleConnection,
    checkAuthorizedEmails
  };
}
