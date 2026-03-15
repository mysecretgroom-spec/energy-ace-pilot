-- 1. Update register_saas_user to auto-grant 10-day trial
CREATE OR REPLACE FUNCTION saas.register_saas_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO saas.access_state (user_id, trial_started_at, trial_ends_at, app_access)
  VALUES (NEW.id, now(), now() + interval '10 days', 'trial');

  INSERT INTO saas.users (user_id, email)
  VALUES (NEW.id, NEW.email);

  RETURN NEW;
END;
$$;

-- 2. Create duplicate check function (callable before signup)
CREATE OR REPLACE FUNCTION public.check_signup_duplicate(p_email text, p_phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email_exists boolean := false;
  v_phone_exists boolean := false;
  v_normalized_phone text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))
  ) INTO v_email_exists;

  IF p_phone IS NOT NULL AND trim(p_phone) != '' THEN
    v_normalized_phone := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');
    
    SELECT EXISTS (
      SELECT 1 FROM profiles 
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized_phone
        AND phone IS NOT NULL AND phone != ''
    ) INTO v_phone_exists;
  END IF;

  RETURN jsonb_build_object(
    'email_exists', v_email_exists,
    'phone_exists', v_phone_exists,
    'has_duplicate', v_email_exists OR v_phone_exists
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_duplicate(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_signup_duplicate(text, text) TO authenticated;