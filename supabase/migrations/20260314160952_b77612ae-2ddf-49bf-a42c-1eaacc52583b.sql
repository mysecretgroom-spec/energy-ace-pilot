-- Drop and recreate functions with new signatures
DROP FUNCTION IF EXISTS public.get_admin_users_overview();
DROP FUNCTION IF EXISTS public.get_saas_access_state(uuid);

CREATE OR REPLACE FUNCTION public.get_admin_users_overview()
RETURNS TABLE(
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz,
  app_access text,
  is_beta_tester boolean,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  past_due_since timestamptz,
  beta_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.created_at,
    a.app_access,
    COALESCE(a.is_beta_tester, false) as is_beta_tester,
    a.trial_started_at,
    a.trial_ends_at,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.status as subscription_status,
    s.current_period_end,
    s.past_due_since,
    a.beta_expires_at
  FROM saas.users u
  LEFT JOIN saas.access_state a ON u.user_id = a.user_id
  LEFT JOIN saas.subscriptions s ON u.user_id = s.user_id
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_saas_access_state(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  app_access text,
  is_beta_tester boolean,
  beta_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.trial_started_at, a.trial_ends_at, a.app_access, a.is_beta_tester, a.beta_expires_at
  FROM saas.access_state a
  WHERE a.user_id = p_user_id;
END;
$$;