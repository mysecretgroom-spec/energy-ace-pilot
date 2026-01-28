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
    if (!user) return false;

    try {
      // First check if record exists
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing record
        const result = await supabase
          .from("user_settings")
          .update({ working_days: newWorkingDays })
          .eq("user_id", user.id);
        error = result.error;
      } else {
        // Insert new record
        const result = await supabase
          .from("user_settings")
          .insert({ user_id: user.id, working_days: newWorkingDays });
        error = result.error;
      }

      if (error) {
        console.error("Error updating working days:", error);
        return false;
      }

      // Update local state after successful save
      setWorkingDays(newWorkingDays);
      return true;
    } catch (err) {
      console.error("Error in updateWorkingDays:", err);
      return false;
    }
  }, [user]);

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
