-- ===========================================
-- WHATSAPP AGENT - DATABASE INFRASTRUCTURE
-- ===========================================

-- 1. Function to find user by phone number and check access
CREATE OR REPLACE FUNCTION public.find_user_by_phone(p_phone text)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  phone text,
  app_access text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized_phone text;
BEGIN
  -- Normalize incoming phone number
  -- Remove whatsapp:, +33, spaces, dashes
  v_normalized_phone := regexp_replace(p_phone, '^(whatsapp:)?\+?33', '0');
  v_normalized_phone := regexp_replace(v_normalized_phone, '[^0-9]', '', 'g');
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name::text,
    p.last_name::text,
    p.phone::text,
    COALESCE(a.app_access, 'unknown')::text
  FROM profiles p
  LEFT JOIN saas.access_state a ON p.user_id = a.user_id
  WHERE regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = v_normalized_phone
    AND p.phone IS NOT NULL
    AND p.phone != '';
END;
$$;

-- 2. Table for WhatsApp messages history
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  from_number TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'audio', 'document')),
  raw_content TEXT,
  media_url TEXT,
  transcribed_content TEXT,
  detected_intent TEXT,
  detected_entities JSONB DEFAULT '{}',
  action_taken TEXT,
  entity_id UUID,
  entity_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'rejected')),
  rejection_reason TEXT,
  response_sent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- 3. Table for conversation context (last 5 messages per user)
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  context JSONB DEFAULT '[]',
  pending_action JSONB,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 4. Enable RLS on both tables
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for whatsapp_messages
CREATE POLICY "Users can view their own WhatsApp messages"
ON public.whatsapp_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert WhatsApp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update WhatsApp messages"
ON public.whatsapp_messages
FOR UPDATE
USING (true);

-- 6. RLS policies for whatsapp_conversations
CREATE POLICY "Users can view their own conversations"
ON public.whatsapp_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage conversations"
ON public.whatsapp_conversations
FOR ALL
USING (true);

-- 7. Indexes for performance
CREATE INDEX idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_from_number ON public.whatsapp_messages(from_number);
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_conversations_user_id ON public.whatsapp_conversations(user_id);