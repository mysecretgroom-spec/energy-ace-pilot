-- Create table to store app assistant conversations
CREATE TABLE public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  last_message_preview TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table to store individual messages in conversations
CREATE TABLE public.agent_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachment_type TEXT,
  attachment_name TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for agent_conversation_messages
CREATE POLICY "Users can view their own messages"
  ON public.agent_conversation_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages"
  ON public.agent_conversation_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.agent_conversation_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_agent_conversations_user_id ON public.agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_updated_at ON public.agent_conversations(updated_at DESC);
CREATE INDEX idx_agent_conversation_messages_conversation_id ON public.agent_conversation_messages(conversation_id);
CREATE INDEX idx_agent_conversation_messages_created_at ON public.agent_conversation_messages(created_at);

-- Trigger to update conversation metadata
CREATE OR REPLACE FUNCTION public.update_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.agent_conversations
  SET 
    updated_at = now(),
    last_message_preview = LEFT(NEW.content, 100),
    message_count = (
      SELECT COUNT(*) FROM public.agent_conversation_messages 
      WHERE conversation_id = NEW.conversation_id
    )
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_agent_message_insert
  AFTER INSERT ON public.agent_conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_metadata();