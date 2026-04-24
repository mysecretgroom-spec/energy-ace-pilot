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
    now() + interval '30 days',
    'trial'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;