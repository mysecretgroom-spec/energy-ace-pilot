CREATE TABLE public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  premium_until timestamptz,
  scheduled_price_id text,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.ai_credit_topups ADD COLUMN IF NOT EXISTS paddle_transaction_id text UNIQUE;
ALTER TABLE public.ai_credit_topups ADD COLUMN IF NOT EXISTS environment text DEFAULT 'live';

-- Current plan: 'premium' | 'classique' | NULL (no paid plan)
CREATE OR REPLACE FUNCTION public.get_user_plan(p_user_id uuid, p_env text DEFAULT 'live')
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub RECORD; v_access RECORD;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions
  WHERE user_id = p_user_id AND environment = p_env
    AND (status IN ('active','trialing','past_due') OR (status = 'canceled' AND current_period_end > now()))
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    IF v_sub.product_id = 'premium_plan' OR (v_sub.premium_until IS NOT NULL AND v_sub.premium_until > now()) THEN
      RETURN 'premium';
    END IF;
    RETURN 'classique';
  END IF;
  SELECT app_access, is_beta_tester, beta_expires_at INTO v_access FROM saas.access_state WHERE user_id = p_user_id;
  IF v_access.is_beta_tester AND (v_access.beta_expires_at IS NULL OR v_access.beta_expires_at > now()) THEN RETURN 'premium'; END IF;
  -- Manually activated accounts without payment keep Premium
  IF v_access.app_access = 'active' THEN RETURN 'premium'; END IF;
  RETURN NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid, text) TO authenticated, service_role;

-- Lock down privilege-changing functions: server-side only
REVOKE EXECUTE ON FUNCTION public.update_saas_access_state(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_saas_subscription(uuid, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_saas_access_state(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_saas_subscription(uuid, text, text, text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.block_saas_user(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_trial_ends_at timestamptz; v_current_access text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT trial_ends_at, app_access INTO v_trial_ends_at, v_current_access FROM saas.access_state WHERE user_id = p_user_id;
  IF v_current_access = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at > now() THEN
    RAISE NOTICE 'Trial still active for %, refusing block', p_user_id; RETURN;
  END IF;
  UPDATE saas.subscriptions SET status = 'blocked', updated_at = now() WHERE user_id = p_user_id;
  UPDATE saas.access_state SET app_access = 'blocked', updated_at = now() WHERE user_id = p_user_id;
END; $function$;