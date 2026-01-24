-- Additional helper functions for edge functions

-- Get expired trials
CREATE OR REPLACE FUNCTION public.get_expired_trials(p_now TIMESTAMPTZ)
RETURNS TABLE (user_id UUID, trial_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.trial_ends_at
  FROM saas.access_state a
  WHERE a.app_access = 'trial' AND a.trial_ends_at < p_now;
END;
$$;

-- Update access state
CREATE OR REPLACE FUNCTION public.update_saas_access_state(p_user_id UUID, p_app_access TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE saas.access_state SET app_access = p_app_access, updated_at = now() WHERE user_id = p_user_id;
END;
$$;

-- Get delinquent subscriptions
CREATE OR REPLACE FUNCTION public.get_delinquent_subscriptions(p_past_due_before TIMESTAMPTZ)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id FROM saas.subscriptions s WHERE s.status = 'past_due' AND s.past_due_since < p_past_due_before;
END;
$$;

-- Block user
CREATE OR REPLACE FUNCTION public.block_saas_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE saas.subscriptions SET status = 'blocked', updated_at = now() WHERE user_id = p_user_id;
  UPDATE saas.access_state SET app_access = 'blocked', updated_at = now() WHERE user_id = p_user_id;
END;
$$;

-- Log notification
CREATE OR REPLACE FUNCTION public.log_saas_notification(p_sent_by UUID, p_audience TEXT, p_title TEXT, p_message TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO saas.notification_log (sent_by, audience, title, message, status)
  VALUES (p_sent_by, p_audience, p_title, p_message, 'queued')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Update notification log
CREATE OR REPLACE FUNCTION public.update_saas_notification_log(p_log_id UUID, p_onesignal_response JSONB, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE saas.notification_log SET onesignal_response = p_onesignal_response, status = p_status WHERE id = p_log_id;
END;
$$;