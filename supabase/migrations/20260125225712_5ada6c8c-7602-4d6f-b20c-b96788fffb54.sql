-- Create table for agent memory per user
CREATE TABLE public.whatsapp_agent_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL, -- 'preference', 'pattern', 'correction', 'context'
  key TEXT NOT NULL, -- e.g. 'default_regie', 'name_alias_dupont', 'status_shortcut'
  value JSONB NOT NULL, -- flexible storage for any type of memory
  confidence NUMERIC DEFAULT 1.0, -- how confident the agent is about this memory
  usage_count INTEGER DEFAULT 1, -- how many times this memory was used
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, memory_type, key)
);

-- Enable RLS
ALTER TABLE public.whatsapp_agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS policies - strict user isolation
CREATE POLICY "Users can view their own agent memories"
  ON public.whatsapp_agent_memory
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own agent memories"
  ON public.whatsapp_agent_memory
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role can manage all memories (for the agent)
CREATE POLICY "Service role full access to agent memories"
  ON public.whatsapp_agent_memory
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_agent_memory_user_type ON public.whatsapp_agent_memory(user_id, memory_type);
CREATE INDEX idx_agent_memory_user_key ON public.whatsapp_agent_memory(user_id, key);

-- Trigger to update updated_at
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON public.whatsapp_agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();