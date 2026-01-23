-- Add push notification preferences to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_new_rdv boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_vente_status boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_rappel_rdv boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_gmail_import boolean DEFAULT true;