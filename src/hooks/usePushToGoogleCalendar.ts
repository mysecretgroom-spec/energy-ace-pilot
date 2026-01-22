import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PushResult {
  success: boolean;
  action: "created" | "updated";
  google_event_id: string;
}

export function usePushToGoogleCalendar() {
  const [pushing, setPushing] = useState(false);

  const pushRdvToCalendar = useCallback(async (rdvId: string): Promise<PushResult | null> => {
    setPushing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("Not authenticated");
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-to-google-calendar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rdv_id: rdvId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "GOOGLE_NOT_CONNECTED") {
          // Silently fail if Google not connected - not an error
          return null;
        }
        console.error("Push to calendar failed:", result.error);
        return null;
      }

      return result as PushResult;
    } catch (error) {
      console.error("Push to calendar error:", error);
      return null;
    } finally {
      setPushing(false);
    }
  }, []);

  return {
    pushing,
    pushRdvToCalendar,
  };
}
