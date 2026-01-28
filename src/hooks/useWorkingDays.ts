import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
// Default: Monday to Saturday (no Sunday)
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

export function useWorkingDays() {
  const { user } = useAuth();
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_DAYS);
  const [loading, setLoading] = useState(true);

  const fetchWorkingDays = useCallback(async () => {
    if (!user) {
      setWorkingDays(DEFAULT_WORKING_DAYS);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("working_days")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching working days:", error);
        setWorkingDays(DEFAULT_WORKING_DAYS);
      } else if (data?.working_days) {
        setWorkingDays(data.working_days);
      } else {
        // Create default settings if not exists
        await supabase.from("user_settings").upsert({
          user_id: user.id,
          working_days: DEFAULT_WORKING_DAYS,
        });
        setWorkingDays(DEFAULT_WORKING_DAYS);
      }
    } catch (err) {
      console.error("Error in fetchWorkingDays:", err);
      setWorkingDays(DEFAULT_WORKING_DAYS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkingDays();
  }, [fetchWorkingDays]);

  const updateWorkingDays = useCallback(async (newWorkingDays: number[]) => {
    if (!user) return;

    // Optimistic update
    setWorkingDays(newWorkingDays);

    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          working_days: newWorkingDays,
        });

      if (error) {
        console.error("Error updating working days:", error);
        // Revert on error
        fetchWorkingDays();
      }
    } catch (err) {
      console.error("Error in updateWorkingDays:", err);
      fetchWorkingDays();
    }
  }, [user, fetchWorkingDays]);

  const isWorkingDay = useCallback((dayOfWeek: number) => {
    return workingDays.includes(dayOfWeek);
  }, [workingDays]);

  return {
    workingDays,
    loading,
    updateWorkingDays,
    isWorkingDay,
    refetch: fetchWorkingDays,
  };
}
