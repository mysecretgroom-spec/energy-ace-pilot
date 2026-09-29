-- Purge de l'historique cron (455k lignes, 500 Mo) qui saturait la base
TRUNCATE cron.job_run_details;

-- Purge des données temporaires expirées
DELETE FROM public.whatsapp_pending_images WHERE expires_at < now() OR created_at < now() - interval '7 days';
DELETE FROM public.google_sync_history WHERE created_at < now() - interval '30 days';

-- Nettoyage automatique quotidien (03h15 UTC)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-db-housekeeping';
SELECT cron.schedule(
  'daily-db-housekeeping',
  '15 3 * * *',
  $$
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days';
    DELETE FROM public.whatsapp_pending_images WHERE expires_at < now() OR created_at < now() - interval '7 days';
    DELETE FROM public.google_sync_history WHERE created_at < now() - interval '30 days';
  $$
);