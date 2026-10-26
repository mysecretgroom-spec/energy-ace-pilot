CREATE OR REPLACE FUNCTION public.admin_list_trials()
RETURNS TABLE (user_id uuid, email text, signed_up_at timestamptz, trial_started_at timestamptz, trial_ends_at timestamptz, app_access text, converted boolean, plan_price_id text, converted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, saas, auth
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT a.user_id, u.email::text, u.created_at, COALESCE(a.trial_started_at, u.created_at), a.trial_ends_at, a.app_access,
         (s.id IS NOT NULL) AS converted, s.price_id, s.created_at
  FROM saas.access_state a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN LATERAL (
    SELECT sb.id, sb.price_id, sb.created_at FROM public.subscriptions sb
    WHERE sb.user_id = a.user_id AND sb.status IN ('active','trialing','past_due')
    ORDER BY sb.created_at ASC LIMIT 1
  ) s ON true
  WHERE a.trial_started_at IS NOT NULL OR a.trial_ends_at IS NOT NULL
  ORDER BY COALESCE(a.trial_started_at, u.created_at) DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_trials() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_trials() TO authenticated;