// Plan catalog (prices TTC, in EUR). Must match the payment provider catalog.
export type PlanTier = "classique" | "premium";
export type BillingCycle = "monthly" | "yearly";

export const PLANS: Record<PlanTier, { name: string; monthly: number; yearly: number; aiBudgetEur: number; features: string[] }> = {
  classique: {
    name: "Classique",
    monthly: 49.99,
    yearly: 499.9,
    aiBudgetEur: 10,
    features: [
      "Planning, distances et itinéraires",
      "CRM, ventes et commissions par régie",
      "Études complètes et rapports",
      "Agent WhatsApp personnel",
      "Gestion des frais et scan des factures",
    ],
  },
  premium: {
    name: "Premium",
    monthly: 89.99,
    yearly: 899.9,
    aiBudgetEur: 15,
    features: [
      "Tout le Classique",
      "Mode HEJJA (documents avec logos officiels)",
      "Quota IA plus élevé",
      "Support prioritaire",
    ],
  },
};

export const priceIdFor = (tier: PlanTier, cycle: BillingCycle) => `${tier}_${cycle}`;
export const tierOfPriceId = (priceId?: string | null): PlanTier | null =>
  priceId?.startsWith("premium") ? "premium" : priceId?.startsWith("classique") ? "classique" : null;

/** Annual = 10 months paid (2 months free). */
export const yearlySavings = (tier: PlanTier) => +(PLANS[tier].monthly * 12 - PLANS[tier].yearly).toFixed(2);

export const TOPUPS = [
  { priceId: "ai_topup_5", amount: 5 },
  { priceId: "ai_topup_20", amount: 20 },
  { priceId: "ai_topup_50", amount: 50 },
];

export const formatEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
