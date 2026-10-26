CREATE OR REPLACE FUNCTION public.is_visitor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = '15ed5718-7392-45a8-9d97-003c4871bf99'::uuid
$$;
GRANT EXECUTE ON FUNCTION public.is_visitor() TO authenticated, anon;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity LOOP
    EXECUTE format('DROP POLICY IF EXISTS visitor_no_insert ON public.%I', t.relname);
    EXECUTE format('DROP POLICY IF EXISTS visitor_no_update ON public.%I', t.relname);
    EXECUTE format('DROP POLICY IF EXISTS visitor_no_delete ON public.%I', t.relname);
    EXECUTE format('CREATE POLICY visitor_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_visitor())', t.relname);
    EXECUTE format('CREATE POLICY visitor_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_visitor())', t.relname);
    EXECUTE format('CREATE POLICY visitor_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_visitor())', t.relname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS visitor_no_upload ON storage.objects;
CREATE POLICY visitor_no_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_visitor());