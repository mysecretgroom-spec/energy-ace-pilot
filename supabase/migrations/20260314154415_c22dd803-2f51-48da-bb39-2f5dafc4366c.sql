
-- RPC to upsert saas subscription (used by webhook)
CREATE OR REPLACE FUNCTION public.upsert_saas_subscription(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_current_period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO saas.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
  VALUES (p_user_id, p_stripe_customer_id, p_stripe_subscription_id, p_status, p_current_period_end, now())
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, saas.subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, saas.subscriptions.stripe_subscription_id),
    status = EXCLUDED.status,
    current_period_end = COALESCE(EXCLUDED.current_period_end, saas.subscriptions.current_period_end),
    past_due_since = CASE 
      WHEN EXCLUDED.status = 'past_due' AND saas.subscriptions.past_due_since IS NULL THEN now()
      WHEN EXCLUDED.status != 'past_due' THEN NULL
      ELSE saas.subscriptions.past_due_since
    END,
    updated_at = now();
END;
$function$;

-- RPC to find user by stripe customer id
CREATE OR REPLACE FUNCTION public.find_user_by_stripe_customer(p_stripe_customer_id text)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.user_id FROM saas.subscriptions s WHERE s.stripe_customer_id = p_stripe_customer_id LIMIT 1;
END;
$function$;

-- RPC to update access state (if not exists)
CREATE OR REPLACE FUNCTION public.update_saas_access_state(p_user_id uuid, p_app_access text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE saas.access_state SET app_access = p_app_access, updated_at = now() WHERE user_id = p_user_id;
END;
$function$;
