-- Add default CQ time to notification settings
ALTER TABLE public.settings_notifications 
ADD COLUMN IF NOT EXISTS default_cq_time TIME DEFAULT '10:00:00';