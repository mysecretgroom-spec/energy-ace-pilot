CREATE OR REPLACE FUNCTION public.purge_expired_data_batched()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int; loops int := 0;
BEGIN
  LOOP
    DELETE FROM public.whatsapp_pending_images
    WHERE id IN (SELECT id FROM public.whatsapp_pending_images
                 WHERE expires_at < now() - interval '1 day' LIMIT 1000);
    GET DIAGNOSTICS n = ROW_COUNT; loops := loops + 1;
    EXIT WHEN n < 1000 OR loops >= 20;
  END LOOP;
  loops := 0;
  LOOP
    DELETE FROM public.google_sync_history
    WHERE id IN (SELECT id FROM public.google_sync_history
                 WHERE created_at < now() - interval '30 days' LIMIT 1000);
    GET DIAGNOSTICS n = ROW_COUNT; loops := loops + 1;
    EXIT WHEN n < 1000 OR loops >= 20;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_data_batched() FROM PUBLIC, anon, authenticated;