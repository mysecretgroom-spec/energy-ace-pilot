-- Function to auto-register a new user in saas tables
CREATE OR REPLACE FUNCTION public.register_saas_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days INTEGER := 15;
BEGIN
  -- Insert into saas.users
  INSERT INTO saas.users (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert into saas.access_state with 15-day trial
  INSERT INTO saas.access_state (user_id, trial_started_at, trial_ends_at, app_access)
  VALUES (
    NEW.id,
    now(),
    now() + (v_trial_days || ' days')::interval,
    'trial'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-registration on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_saas ON auth.users;
CREATE TRIGGER on_auth_user_created_saas
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.register_saas_user();