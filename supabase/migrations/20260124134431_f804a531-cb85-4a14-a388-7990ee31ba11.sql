-- Functions to access saas schema from frontend

-- Get user's access state
CREATE OR REPLACE FUNCTION public.get_saas_access_state(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  app_access TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.trial_started_at, a.trial_ends_at, a.app_access, a.updated_at
  FROM saas.access_state a
  WHERE a.user_id = p_user_id;
END;
$$;

-- Get user's subscription
CREATE OR REPLACE FUNCTION public.get_saas_subscription(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, s.stripe_customer_id, s.stripe_subscription_id, s.status, s.current_period_end, s.past_due_since, s.updated_at
  FROM saas.subscriptions s
  WHERE s.user_id = p_user_id;
END;
$$;

-- Check if user is saas admin
CREATE OR REPLACE FUNCTION public.is_saas_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = p_user_id);
END;
$$;

-- Get all saas users (admin only)
CREATE OR REPLACE FUNCTION public.get_saas_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  sector TEXT,
  onesignal_external_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT u.user_id, u.email, u.first_name, u.last_name, u.sector, u.onesignal_external_id, u.created_at FROM saas.users u;
END;
$$;

-- Get all access states (admin only)
CREATE OR REPLACE FUNCTION public.get_all_saas_access_states()
RETURNS TABLE (
  user_id UUID,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  app_access TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT a.user_id, a.trial_started_at, a.trial_ends_at, a.app_access, a.updated_at FROM saas.access_state a;
END;
$$;

-- Get all subscriptions (admin only)
CREATE OR REPLACE FUNCTION public.get_all_saas_subscriptions()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT s.id, s.user_id, s.stripe_customer_id, s.stripe_subscription_id, s.status, s.current_period_end, s.past_due_since, s.updated_at FROM saas.subscriptions s;
END;
$$;

-- Get notification logs (admin only)
CREATE OR REPLACE FUNCTION public.get_saas_notification_logs()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  sent_by UUID,
  audience TEXT,
  title TEXT,
  message TEXT,
  onesignal_response JSONB,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT n.id, n.created_at, n.sent_by, n.audience, n.title, n.message, n.onesignal_response, n.status 
  FROM saas.notification_log n 
  ORDER BY n.created_at DESC 
  LIMIT 50;
END;
$$;

-- Get support tickets for user
CREATE OR REPLACE FUNCTION public.get_my_support_tickets()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  subject TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT t.id, t.user_id, t.subject, t.message, t.status, t.created_at, t.updated_at 
  FROM saas.support_tickets t 
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC;
END;
$$;

-- Get all support tickets (admin only)
CREATE OR REPLACE FUNCTION public.get_all_support_tickets()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  subject TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT t.id, t.user_id, t.subject, t.message, t.status, t.created_at, t.updated_at 
  FROM saas.support_tickets t
  ORDER BY t.created_at DESC;
END;
$$;

-- Get ticket replies
CREATE OR REPLACE FUNCTION public.get_ticket_replies(p_ticket_id UUID)
RETURNS TABLE (
  id UUID,
  ticket_id UUID,
  user_id UUID,
  is_admin BOOLEAN,
  message TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user owns the ticket or is admin
  IF NOT EXISTS (
    SELECT 1 FROM saas.support_tickets WHERE id = p_ticket_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT r.id, r.ticket_id, r.user_id, r.is_admin, r.message, r.created_at 
  FROM saas.support_replies r 
  WHERE r.ticket_id = p_ticket_id
  ORDER BY r.created_at ASC;
END;
$$;

-- Create support ticket
CREATE OR REPLACE FUNCTION public.create_support_ticket(p_subject TEXT, p_message TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  INSERT INTO saas.support_tickets (user_id, subject, message)
  VALUES (auth.uid(), p_subject, p_message)
  RETURNING id INTO v_ticket_id;
  
  RETURN v_ticket_id;
END;
$$;

-- Add ticket reply
CREATE OR REPLACE FUNCTION public.add_ticket_reply(p_ticket_id UUID, p_message TEXT, p_is_admin BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reply_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check permissions
  v_is_admin := EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid());
  
  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM saas.support_tickets WHERE id = p_ticket_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  INSERT INTO saas.support_replies (ticket_id, user_id, is_admin, message)
  VALUES (p_ticket_id, auth.uid(), v_is_admin, p_message)
  RETURNING id INTO v_reply_id;
  
  RETURN v_reply_id;
END;
$$;

-- Update ticket status (admin only)
CREATE OR REPLACE FUNCTION public.update_ticket_status(p_ticket_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE saas.support_tickets SET status = p_status, updated_at = now() WHERE id = p_ticket_id;
END;
$$;

-- Get feature requests
CREATE OR REPLACE FUNCTION public.get_all_feature_requests()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  votes INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY SELECT f.id, f.user_id, f.title, f.description, f.status, f.votes, f.created_at, f.updated_at 
  FROM saas.feature_requests f
  ORDER BY f.votes DESC;
END;
$$;

-- Update feature request status (admin only)
CREATE OR REPLACE FUNCTION public.update_feature_status(p_feature_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM saas.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE saas.feature_requests SET status = p_status, updated_at = now() WHERE id = p_feature_id;
END;
$$;