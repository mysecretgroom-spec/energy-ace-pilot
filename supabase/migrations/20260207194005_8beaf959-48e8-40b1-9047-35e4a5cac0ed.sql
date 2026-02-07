
-- Add settings for relance paiement and weekly recap
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS relance_paiement_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS relance_paiement_delay_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS weekly_recap_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_recap_day integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS weekly_recap_hour integer DEFAULT 13;
