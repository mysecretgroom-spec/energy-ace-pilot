import { callGoogleAccount } from "@/lib/googleConnection";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  errors?: string[];
}

export function useGoogleCalendarSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  const inFlight = useRef(false);

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

  const syncCalendar = useCallback(async (options?: {
    daysAhead?: number;
    daysBefore?: number;
    silent?: boolean;
  }): Promise<SyncResult | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSyncing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!options?.silent) toast({
          variant: "destructive",
          title: "Non connecté",
          description: "Veuillez vous connecter pour synchroniser.",
        });
        return null;
      }

      const params = new URLSearchParams({
        action: "sync",
        daysAhead: String(options?.daysAhead || 30),
        daysBefore: String(options?.daysBefore || 7),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-google-calendar?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "GOOGLE_NOT_CONNECTED") {
          if (!options?.silent) toast({
            variant: "destructive",
            title: "Google non connecté",
            description: "Veuillez d'abord connecter votre compte Google.",
          });
        } else {
          if (!options?.silent) toast({
            variant: "destructive",
            title: "Erreur de synchronisation",
            description: result.error || "Une erreur est survenue.",
          });
        }
        return null;
      }

      setLastSync(new Date());

      if (!options?.silent) toast({
        title: "Synchronisation terminée",
        description: `${result.imported} importés, ${result.updated} mis à jour, ${result.skipped} ignorés`,
      });

      return result as SyncResult;
    } catch (error) {
      console.error("Sync error:", error);
      if (!options?.silent) toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de synchroniser avec Google Calendar.",
      });
      return null;
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [toast]);

  return {
    syncing,
    lastSync,
    syncCalendar,
    checkGoogleConnection,
  };
}
