ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS last_executed_action JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_action_message_sid TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_action_sid 
ON public.whatsapp_conversations(last_action_message_sid) 
WHERE last_action_message_sid IS NOT NULL;