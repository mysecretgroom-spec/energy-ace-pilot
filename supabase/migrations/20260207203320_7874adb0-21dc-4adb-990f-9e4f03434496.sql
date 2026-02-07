-- Add proactive notification settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS rdv_prep_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS rdv_prep_minutes_before integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS rdv_prep_whatsapp boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pipeline_alerts_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pipeline_stale_days integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS coaching_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_briefing_whatsapp boolean DEFAULT true;