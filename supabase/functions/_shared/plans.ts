// Plan catalog shared by payment functions (human-readable price ids).
export const PLAN_PRICES = ['classique_monthly', 'classique_yearly', 'premium_monthly', 'premium_yearly'] as const;
export const TOPUP_PRICES: Record<string, number> = { ai_topup_5: 5, ai_topup_20: 20, ai_topup_50: 50 };
export const tierOf = (priceId: string) => (priceId.startsWith('premium') ? 2 : 1);
/** Monthly AI budget included per plan, in EUR. */
export const PLAN_AI_BUDGET_EUR: Record<string, number> = { classique: 10, premium: 15 };
