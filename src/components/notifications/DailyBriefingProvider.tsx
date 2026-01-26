import { useEffect } from "react";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useAuth } from "@/hooks/useAuth";

export function DailyBriefingProvider() {
  const { user } = useAuth();
  
  // This hook triggers the briefing on first connection of the day
  useDailyBriefing();

  return null;
}
