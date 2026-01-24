-- Add column to skip WhatsApp confirmation prompt
ALTER TABLE public.settings_notifications 
ADD COLUMN skip_whatsapp_prompt boolean DEFAULT false;