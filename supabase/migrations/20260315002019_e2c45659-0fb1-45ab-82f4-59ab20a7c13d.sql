-- Create RPC to find users whose trial expires within a date range
CREATE OR REPLACE FUNCTION public.get_trial_expiring_soon(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(user_id uuid, trial_ends_at timestamptz, email text, phone text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.user_id,
    a.trial_ends_at,
    u.email::text,
    p.phone::text,
    p.first_name::text
  FROM saas.access_state a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN profiles p ON p.user_id = a.user_id
  WHERE a.app_access = 'trial'
    AND a.trial_ends_at >= p_from
    AND a.trial_ends_at < p_to;
END;
$$;