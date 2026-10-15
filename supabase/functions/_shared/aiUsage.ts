// Shared AI usage tracking & budget enforcement
// Used by all edge functions calling Lovable AI Gateway (Gemini)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Pricing in USD per 1M tokens (rough Lovable AI gateway estimates - keep conservative/upper bound)
const MODEL_PRICING: Record<string, { input: number; output: number; image?: number }> = {
  "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "google/gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "google/gemini-3-flash-preview": { input: 0.30, output: 2.50 },
  "google/gemini-3.1-pro-preview": { input: 1.25, output: 10.0 },
  "google/gemini-2.5-flash-image": { input: 0.30, output: 2.50, image: 0.039 },
  "google/gemini-3-pro-image-preview": { input: 1.25, output: 10.0, image: 0.05 },
  "google/gemini-3.1-flash-image-preview": { input: 0.30, output: 2.50, image: 0.039 },
  "openai/gpt-5": { input: 1.25, output: 10.0 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.0 },
  "openai/gpt-5-nano": { input: 0.05, output: 0.40 },
};

// Monthly budget: 10 EUR ≈ 10.87 USD (EUR/USD ~ 0.92)
export const MONTHLY_BUDGET_USD = 10.87;
export const WARNING_THRESHOLD = 0.80; // 80%
export const SOFT_CAP_THRESHOLD = 1.00; // 100% → force flash-lite
export const HARD_CAP_THRESHOLD = 1.50; // 150% → block
const EUR_TO_USD = 1.087;
// Monthly AI budget per plan (EUR). Top-ups extend it beyond the plan quota.
const PLAN_BUDGET_EUR: Record<string, number> = { classique: 10, premium: 15 };

async function getPlanBudgetUsd(supabase: any, userId: string): Promise<number> {
  for (const env of ["live", "sandbox"]) {
    const { data } = await supabase.rpc("get_user_plan", { p_user_id: userId, p_env: env });
    if (data && PLAN_BUDGET_EUR[data]) return PLAN_BUDGET_EUR[data] * EUR_TO_USD;
  }
  return MONTHLY_BUDGET_USD;
}

async function getTopupBalanceEur(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase.rpc("get_user_topup_balance", { p_user_id: userId });
  return Number(data || 0);
}

// Functions exempted from hard cap (critical business flows)
const CRITICAL_FUNCTIONS = new Set([
  "send-whatsapp-notification",
  "send-whatsapp-pdf",
  "daily-recap",
  "morning-briefing",
  "reconcile-installation-rdvs",
  "scheduled-recap",
]);

export type BudgetStatus = "ok" | "warning" | "soft_capped" | "hard_capped";

export interface BudgetCheck {
  used_usd: number;
  budget_usd: number;
  ratio: number;
  status: BudgetStatus;
  forceModel: string | null;
  blocked: boolean;
}

function getMonthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/**
 * Check current month usage for a user and return budget status.
 * Fail-open: if DB check fails, returns status "ok" so the agent doesn't break.
 */
export async function checkUsageBudget(
  userId: string | null | undefined,
  functionName: string,
): Promise<BudgetCheck> {
  const safeDefault: BudgetCheck = {
    used_usd: 0,
    budget_usd: MONTHLY_BUDGET_USD,
    ratio: 0,
    status: "ok",
    forceModel: null,
    blocked: false,
  };

  if (!userId) return safeDefault;

  try {
    const supabase = getServiceClient();
    const monthKey = getMonthKey();

    const { data, error } = await supabase
      .from("ai_usage")
      .select("estimated_cost_usd")
      .eq("user_id", userId)
      .eq("month_key", monthKey);

    if (error) {
      console.error("[aiUsage] check failed (fail-open):", error.message);
      return safeDefault;
    }

    const used = (data || []).reduce((sum, row: any) => sum + Number(row.estimated_cost_usd || 0), 0);
    const budget = await getPlanBudgetUsd(supabase, userId);
    const ratio = used / budget;
    // Over quota but covered by a paid top-up: keep full service
    if (ratio >= SOFT_CAP_THRESHOLD && (await getTopupBalanceEur(supabase, userId)) > 0) {
      return { used_usd: used, budget_usd: budget, ratio, status: "warning", forceModel: null, blocked: false };
    }

    let status: BudgetStatus = "ok";
    let forceModel: string | null = null;
    let blocked = false;

    if (ratio >= HARD_CAP_THRESHOLD) {
      status = "hard_capped";
      blocked = !CRITICAL_FUNCTIONS.has(functionName);
      forceModel = "google/gemini-2.5-flash-lite";
    } else if (ratio >= SOFT_CAP_THRESHOLD) {
      status = "soft_capped";
      forceModel = "google/gemini-2.5-flash-lite";
    } else if (ratio >= WARNING_THRESHOLD) {
      status = "warning";
    }

    return { used_usd: used, budget_usd: budget, ratio, status, forceModel, blocked };
  } catch (e) {
    console.error("[aiUsage] check exception (fail-open):", e);
    return safeDefault;
  }
}

/**
 * Log usage from a Lovable AI Gateway response payload.
 * Non-blocking: errors are logged but never thrown.
 */
export async function logUsage(params: {
  userId: string | null | undefined;
  functionName: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  imageCount?: number;
}): Promise<void> {
  if (!params.userId) return;
  try {
    const pricing = MODEL_PRICING[params.model] || MODEL_PRICING["google/gemini-2.5-flash"];
    const inputTokens = params.usage?.prompt_tokens ?? 0;
    const outputTokens = params.usage?.completion_tokens ?? 0;
    const imageCount = params.imageCount ?? 0;

    const cost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      imageCount * (pricing.image ?? 0);

    const supabase = getServiceClient();
    await supabase.from("ai_usage").insert({
      user_id: params.userId,
      function_name: params.functionName,
      model: params.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      image_count: imageCount,
      estimated_cost_usd: cost,
      month_key: getMonthKey(),
    });

    // Usage beyond the plan quota is deducted from paid top-ups
    const { data: rows } = await supabase.from("ai_usage").select("estimated_cost_usd")
      .eq("user_id", params.userId).eq("month_key", getMonthKey());
    const total = (rows || []).reduce((s: number, r: any) => s + Number(r.estimated_cost_usd || 0), 0);
    const budget = await getPlanBudgetUsd(supabase, params.userId);
    const overflowUsd = Math.min(cost, Math.max(0, total - budget));
    if (overflowUsd > 0) {
      await supabase.rpc("consume_topup_balance", { p_user_id: params.userId, p_amount_eur: overflowUsd / EUR_TO_USD });
    }
  } catch (e) {
    console.error("[aiUsage] log failed (non-blocking):", e);
  }
}

/**
 * Resolve user_id from request: prefers JWT auth header, falls back to body field.
 */
export async function resolveUserId(req: Request, bodyUserId?: string | null): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const supabase = getServiceClient();
      const { data } = await supabase.auth.getUser(token);
      if (data?.user?.id) return data.user.id;
    }
  } catch {
    // ignore
  }
  return bodyUserId ?? null;
}

export const HARD_CAP_MESSAGE =
  "Vous avez dépassé votre budget IA mensuel. Rechargez votre crédit IA depuis la page Abonnement, ou l'agent sera de nouveau disponible le 1er du mois prochain. Les notifications automatiques restent actives.";
