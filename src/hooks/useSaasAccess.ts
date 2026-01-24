import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppAccess = "trial" | "active" | "paywall" | "blocked";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "unpaid" | "blocked" | "incomplete";

interface SaasAccessState {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  app_access: AppAccess;
}

interface SaasSubscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
}

export function useSaasAccess() {
  const { user } = useAuth();

  const { data: accessState, isLoading: isLoadingAccess } = useQuery({
    queryKey: ["saas-access-state", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_saas_access_state" as any, {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching access state:", error);
        return null;
      }

      return data?.[0] as SaasAccessState | null;
    },
    enabled: !!user?.id,
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["saas-subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_saas_subscription" as any, {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching subscription:", error);
        return null;
      }

      return data?.[0] as SaasSubscription | null;
    },
    enabled: !!user?.id,
  });

  const daysLeftInTrial = accessState?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(accessState.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isInTrial = accessState?.app_access === "trial";
  const isActive = accessState?.app_access === "active";
  const isPaywall = accessState?.app_access === "paywall";
  const isBlocked = accessState?.app_access === "blocked";
  const hasAccess = isInTrial || isActive;

  return {
    accessState,
    subscription,
    isLoading: isLoadingAccess || isLoadingSubscription,
    daysLeftInTrial,
    isInTrial,
    isActive,
    isPaywall,
    isBlocked,
    hasAccess,
    appAccess: accessState?.app_access as AppAccess | undefined,
    subscriptionStatus: subscription?.status as SubscriptionStatus | undefined,
  };
}
