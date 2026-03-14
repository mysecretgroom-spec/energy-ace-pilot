
DROP FUNCTION IF EXISTS public.get_saas_access_state(uuid);
DROP FUNCTION IF EXISTS public.get_all_saas_access_states();

CREATE OR REPLACE FUNCTION public.get_saas_access_state(p_user_id uuid)
 RETURNS TABLE(user_id uuid, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, app_access text, updated_at timestamp with time zone, is_beta_tester boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.trial_started_at, a.trial_ends_at, a.app_access, a.updated_at, a.is_beta_tester
  FROM saas.access_state a
  WHERE a.user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_saas_access_states()
 RETURNS TABLE(user_id uuid, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, app_access text, updated_at timestamp with time zone, is_beta_tester boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT a.user_id, a.trial_started_at, a.trial_ends_at, a.app_access, a.updated_at, a.is_beta_tester FROM saas.access_state a;
END;
$function$;
