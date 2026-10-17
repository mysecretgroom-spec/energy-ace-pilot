import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPaddleEnvironment } from "@/lib/paddle";
import type { PlanTier } from "@/lib/plans";

export type AppAccess = "trial" | "active" | "paywall" | "blocked";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "unpaid" | "blocked" | "incomplete";

interface SaasAccessState {
  user_id: string;
  trial_started_at: string;
  trial_ends_at: string;
  app_access: AppAccess;
  is_beta_tester: boolean;
  beta_expires_at: string | null;
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

  const { data: accessState, isLoading: isLoadingAccess, error: accessError, refetch: refetchAccess } = useQuery({
    queryKey: ["saas-access-state", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_saas_access_state" as any, {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching access state:", error);
        throw error;
      }

      return (data?.[0] as SaasAccessState | null | undefined) ?? null;
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const { data: subscription, isLoading: isLoadingSubscription, error: subscriptionError, refetch: refetchSubscription } = useQuery({
    queryKey: ["saas-subscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_saas_subscription" as any, {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching subscription:", error);
        throw error;
      }

      return (data?.[0] as SaasSubscription | null | undefined) ?? null;
    },
    enabled: !!user?.id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const env = getPaddleEnvironment();
  const { data: billing, isLoading: isLoadingBilling, error: billingError, refetch: refetchBilling } = useQuery({
    queryKey: ["billing", user?.id, env],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return null;
      const [{ data: plan, error: planError }, { data: sub, error: subError }] = await Promise.all([
        supabase.rpc("get_user_plan" as any, { p_user_id: user.id, p_env: env }),
        supabase.from("subscriptions" as any).select("*")
          .eq("user_id", user.id).eq("environment", env)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (planError) throw planError;
      if (subError) throw subError;
      return { plan: (plan as PlanTier | null) ?? null, paidSubscription: (sub as any) ?? null };
    },
  });

  const daysLeftInTrial = accessState?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(accessState.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isBetaExpired = accessState?.is_beta_tester === true 
    && accessState?.beta_expires_at 
    && new Date(accessState.beta_expires_at) < new Date();
  const isBetaTester = accessState?.is_beta_tester === true && !isBetaExpired;
  const isInTrial = accessState?.app_access === "trial";
  const isActive = accessState?.app_access === "active";
  const isPaywall = !isBetaTester && (accessState?.app_access === "paywall" || !!isBetaExpired);
  const isBlocked = !isBetaTester && accessState?.app_access === "blocked";
  const hasAccess = isBetaTester || isInTrial || isActive;

  return {
    accessState,
    subscription,
    isLoading: isLoadingAccess || isLoadingSubscription || isLoadingBilling,
    error: accessError || subscriptionError || billingError,
    retry: () => Promise.all([refetchAccess(), refetchSubscription(), refetchBilling()]),
    /** Current paid tier ('premium' also for beta testers / manually activated accounts) */
    plan: billing?.plan ?? null,
    isPremium: billing?.plan === "premium",
    paidSubscription: billing?.paidSubscription ?? null,
    daysLeftInTrial,
    isBetaTester,
    isInTrial,
    isActive,
    isPaywall,
    isBlocked,
    hasAccess,
    appAccess: accessState?.app_access as AppAccess | undefined,
    subscriptionStatus: subscription?.status as SubscriptionStatus | undefined,
  };
}
