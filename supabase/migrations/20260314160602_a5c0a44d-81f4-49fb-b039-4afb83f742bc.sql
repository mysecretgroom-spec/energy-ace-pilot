
-- RPC to toggle beta tester status
CREATE OR REPLACE FUNCTION public.toggle_beta_tester(p_target_user_id uuid, p_is_beta boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE saas.access_state
  SET is_beta_tester = p_is_beta,
      app_access = CASE 
        WHEN p_is_beta THEN 'active'
        ELSE app_access
      END,
      updated_at = now()
  WHERE user_id = p_target_user_id;
END;
$$;

-- RPC to update user access state (block/unblock)
CREATE OR REPLACE FUNCTION public.admin_update_access_state(p_target_user_id uuid, p_app_access text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE saas.access_state
  SET app_access = p_app_access, updated_at = now()
  WHERE user_id = p_target_user_id;
END;
$$;

-- Enhanced RPC to get all users with access + subscription data combined
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
  past_due_since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    s.past_due_since
  FROM saas.users u
  LEFT JOIN saas.access_state a ON u.user_id = a.user_id
  LEFT JOIN saas.subscriptions s ON u.user_id = s.user_id
  ORDER BY u.created_at DESC;
END;
$$;
