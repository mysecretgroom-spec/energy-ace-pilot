DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE') = true
      AND p.proname NOT IN ('check_signup_duplicate')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      fn.nspname, fn.proname, fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      fn.nspname, fn.proname, fn.args
    );
  END LOOP;
END;
$$;