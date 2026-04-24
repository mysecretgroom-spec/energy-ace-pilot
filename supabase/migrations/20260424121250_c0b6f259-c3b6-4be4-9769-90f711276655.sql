-- Protect active trials from premature paywall/block transitions
-- Source of truth: saas.access_state.trial_ends_at

CREATE OR REPLACE FUNCTION public.update_saas_access_state(p_user_id uuid, p_app_access text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_ends_at timestamptz;
  v_current_access text;
BEGIN
  SELECT trial_ends_at, app_access
    INTO v_trial_ends_at, v_current_access
  FROM saas.access_state
  WHERE user_id = p_user_id;

  -- Guard: if user is still within trial window, refuse to downgrade to paywall/blocked
  IF p_app_access IN ('paywall', 'blocked')
     AND v_current_access = 'trial'
     AND v_trial_ends_at IS NOT NULL
     AND v_trial_ends_at > now() THEN
    RAISE NOTICE 'Trial still active for %, refusing transition to %', p_user_id, p_app_access;
    RETURN;
  END IF;

  UPDATE saas.access_state
  SET app_access = p_app_access, updated_at = now()
  WHERE user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.block_saas_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trial_ends_at timestamptz;
  v_current_access text;
BEGIN
  SELECT trial_ends_at, app_access
    INTO v_trial_ends_at, v_current_access
  FROM saas.access_state
  WHERE user_id = p_user_id;

  -- Do not block users still in their active trial window
  IF v_current_access = 'trial'
     AND v_trial_ends_at IS NOT NULL
     AND v_trial_ends_at > now() THEN
    RAISE NOTICE 'Trial still active for %, refusing block', p_user_id;
    RETURN;
  END IF;

  UPDATE saas.subscriptions SET status = 'blocked', updated_at = now() WHERE user_id = p_user_id;
  UPDATE saas.access_state SET app_access = 'blocked', updated_at = now() WHERE user_id = p_user_id;
END;
$function$;

-- Admin-only escape hatch: force a state change regardless of trial status
CREATE OR REPLACE FUNCTION public.admin_force_access_state(p_user_id uuid, p_app_access text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE saas.access_state
  SET app_access = p_app_access, updated_at = now()
  WHERE user_id = p_user_id;

  PERFORM public.log_admin_action(
    'force_access_state',
    'user',
    p_user_id::text,
    jsonb_build_object('app_access', p_app_access)
  );
END;
$function$;