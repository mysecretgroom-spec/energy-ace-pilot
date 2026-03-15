import { useSaasAccess } from "@/hooks/useSaasAccess";

/**
 * Features restricted during trial period.
 * Premium features require an active subscription.
 */
export type PremiumFeature = 
  | "etude_resultats"    // Résultats d'études (PDF generation)
  | "mode_hejja"         // Mode HEJJA (price override)
  | "agent_ia";          // Agent IA (limited to 30 factures in trial)

const TRIAL_RESTRICTED_FEATURES: PremiumFeature[] = [
  "etude_resultats",
  "mode_hejja",
  "agent_ia",
];

/** Max expense invoices via agent during trial */
export const TRIAL_AGENT_FACTURE_LIMIT = 30;

export function useTrialFeatures() {
  const { isInTrial, isActive, isBetaTester, hasAccess } = useSaasAccess();

  const isPremiumUser = isActive || isBetaTester;

  const canAccess = (feature: PremiumFeature): boolean => {
    // Active subscribers and beta testers have full access
    if (isPremiumUser) return true;
    // Trial users: check if feature is restricted
    if (isInTrial) {
      // agent_ia is partially allowed in trial (only factures, limited to 30)
      if (feature === "agent_ia") return true;
      return !TRIAL_RESTRICTED_FEATURES.includes(feature);
    }
    // Paywall/blocked: no access at all (handled by ProtectedRoute)
    return false;
  };

  return {
    canAccess,
    isPremiumUser,
    isTrialUser: isInTrial,
    hasAccess,
  };
}
