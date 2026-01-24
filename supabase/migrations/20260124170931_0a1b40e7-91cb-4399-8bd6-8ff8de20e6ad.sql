-- Create audit_logs table for tracking admin actions
CREATE TABLE public.saas_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saas_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.saas_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON public.saas_audit_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM saas.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_created_at ON public.saas_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_admin_user ON public.saas_audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON public.saas_audit_logs(action);

-- Create RPC function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.saas_audit_logs (admin_user_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Create RPC function to get revenue analytics
CREATE OR REPLACE FUNCTION public.get_revenue_analytics(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  month TEXT,
  total_users BIGINT,
  trial_users BIGINT,
  active_users BIGINT,
  churned_users BIGINT,
  new_signups BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start_date::timestamp),
      date_trunc('month', p_end_date::timestamp),
      '1 month'::interval
    ) AS month_start
  ),
  monthly_stats AS (
    SELECT 
      m.month_start,
      COUNT(DISTINCT a.user_id) AS total_users,
      COUNT(DISTINCT CASE WHEN a.app_access = 'trial' THEN a.user_id END) AS trial_users,
      COUNT(DISTINCT CASE WHEN a.app_access = 'active' THEN a.user_id END) AS active_users,
      COUNT(DISTINCT CASE WHEN a.app_access IN ('paywall', 'blocked') THEN a.user_id END) AS churned_users
    FROM months m
    LEFT JOIN saas.access_states a ON date_trunc('month', a.trial_started_at) <= m.month_start
    GROUP BY m.month_start
  ),
  signups AS (
    SELECT 
      date_trunc('month', trial_started_at) AS month_start,
      COUNT(*) AS new_signups
    FROM saas.access_states
    WHERE trial_started_at >= p_start_date AND trial_started_at <= p_end_date
    GROUP BY date_trunc('month', trial_started_at)
  )
  SELECT 
    to_char(ms.month_start, 'YYYY-MM') AS month,
    ms.total_users,
    ms.trial_users,
    ms.active_users,
    ms.churned_users,
    COALESCE(s.new_signups, 0) AS new_signups
  FROM monthly_stats ms
  LEFT JOIN signups s ON ms.month_start = s.month_start
  ORDER BY ms.month_start;
END;
$$;

-- Create RPC to get audit logs with pagination
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_action_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  admin_email TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    u.email AS admin_email,
    l.action,
    l.target_type,
    l.target_id,
    l.details,
    l.created_at
  FROM public.saas_audit_logs l
  LEFT JOIN auth.users u ON l.admin_user_id = u.id
  WHERE (p_action_filter IS NULL OR l.action = p_action_filter)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;