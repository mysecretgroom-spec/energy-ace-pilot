-- Add reply_to_message_id column to support replying to specific messages
ALTER TABLE public.agent_conversation_messages 
ADD COLUMN reply_to_message_id uuid REFERENCES public.agent_conversation_messages(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX idx_agent_messages_reply_to ON public.agent_conversation_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;