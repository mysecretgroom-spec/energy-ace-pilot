-- =====================================================================
-- 1) Fix overly permissive ai_workflows policy
-- =====================================================================
DROP POLICY IF EXISTS "Admins can manage ai_workflows" ON public.ai_workflows;

CREATE POLICY "Admins can manage ai_workflows"
ON public.ai_workflows
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 2) Revoke anon EXECUTE on SECURITY DEFINER functions
-- =====================================================================
-- Strategy: revoke from anon everywhere, then re-grant only the few that
-- must remain callable pre-login (signup duplicate check).
-- authenticated + service_role retain EXECUTE.

DO $$
DECLARE
  fn RECORD;
  sql_revoke TEXT;
  sql_grant_auth TEXT;
  sql_grant_svc TEXT;
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
    sql_revoke := format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
      fn.nspname, fn.proname, fn.args
    );
    EXECUTE sql_revoke;

    sql_grant_auth := format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      fn.nspname, fn.proname, fn.args
    );
    EXECUTE sql_grant_auth;

    sql_grant_svc := format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      fn.nspname, fn.proname, fn.args
    );
    EXECUTE sql_grant_svc;
  END LOOP;
END;
$$;

-- Confirm check_signup_duplicate stays open (no-op if already granted)
DO $$
DECLARE oid_check OID;
BEGIN
  SELECT p.oid INTO oid_check
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'check_signup_duplicate'
  LIMIT 1;
  IF oid_check IS NOT NULL THEN
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.check_signup_duplicate(%s) TO anon, authenticated',
      pg_get_function_identity_arguments(oid_check)
    );
  END IF;
END;
$$;