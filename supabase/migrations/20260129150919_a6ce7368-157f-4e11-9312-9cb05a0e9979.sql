-- Add columns for WhatsApp reply-to-message tracking and multiple media support
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS twilio_message_sid text,
ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS media_types text[] DEFAULT ARRAY[]::text[];

-- Create index for reply lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_reply_to 
ON public.whatsapp_messages(reply_to_message_id) 
WHERE reply_to_message_id IS NOT NULL;

-- Create index for Twilio SID lookups (to find original messages when receiving replies)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_twilio_sid 
ON public.whatsapp_messages(twilio_message_sid) 
WHERE twilio_message_sid IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_messages.twilio_message_sid IS 'Twilio message SID for tracking replies';
COMMENT ON COLUMN public.whatsapp_messages.reply_to_message_id IS 'Reference to the message this is replying to';
COMMENT ON COLUMN public.whatsapp_messages.media_urls IS 'Array of media URLs for multi-file messages';
COMMENT ON COLUMN public.whatsapp_messages.media_types IS 'Array of media content types for multi-file messages';