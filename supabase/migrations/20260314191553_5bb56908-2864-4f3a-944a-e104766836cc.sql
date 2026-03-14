
CREATE OR REPLACE FUNCTION public.register_saas_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO saas.users (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO saas.access_state (user_id, trial_started_at, trial_ends_at, app_access)
  VALUES (
    NEW.id,
    now(),
    now(),
    'paywall'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_grant_trial(
  p_target_user_id uuid,
  p_trial_days integer DEFAULT 15
)
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
  SET 
    app_access = 'trial',
    trial_started_at = now(),
    trial_ends_at = now() + (p_trial_days || ' days')::interval,
    updated_at = now()
  WHERE user_id = p_target_user_id;

  PERFORM log_admin_action(
    'grant_trial',
    'user',
    p_target_user_id::text,
    jsonb_build_object('trial_days', p_trial_days)
  );
END;
$function$;
