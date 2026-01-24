-- Change default value of gmail_sync_enabled to true
ALTER TABLE public.user_settings ALTER COLUMN gmail_sync_enabled SET DEFAULT true;