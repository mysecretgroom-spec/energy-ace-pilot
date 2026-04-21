-- Add a column to track all pending workflow message SIDs
-- Maps Twilio SID -> snapshot of the pending_action at the time of sending
-- This lets the agent route a quoted-reply to the correct workflow,
-- even when multiple agent messages are awaiting a response.
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS pending_message_sids jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pending_sids
  ON public.whatsapp_conversations USING gin (pending_message_sids);

COMMENT ON COLUMN public.whatsapp_conversations.pending_message_sids IS
  'Maps Twilio message SID -> { workflowState, pendingAction snapshot, createdAt }. Used to route quoted-replies to the correct workflow context when several questions are awaiting a response.';