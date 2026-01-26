import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BRIEFING_KEY = "last-daily-briefing";

export function useDailyBriefing() {
  const { user } = useAuth();

  const triggerBriefing = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const lastBriefing = localStorage.getItem(`${BRIEFING_KEY}-${user.id}`);

    // Already sent today
    if (lastBriefing === today) {
      return;
    }

    try {
      console.log("Triggering daily briefing for user:", user.id);
      
      const { data, error } = await supabase.functions.invoke("daily-briefing-user", {
        body: { userId: user.id },
      });

      if (error) {
        console.error("Daily briefing error:", error);
        return;
      }

      // Mark as sent for today
      localStorage.setItem(`${BRIEFING_KEY}-${user.id}`, today);
      
      if (data?.rdv_count > 0) {
        toast.success(`☀️ Briefing envoyé ! ${data.rdv_count} RDV aujourd'hui`, {
          duration: 4000,
        });
      }
      
      console.log("Daily briefing result:", data);
    } catch (error) {
      console.error("Failed to trigger daily briefing:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Small delay to let the app fully load
      const timer = setTimeout(() => {
        triggerBriefing();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, triggerBriefing]);

  return { triggerBriefing };
}
