-- Create table for user-defined agent prompt tokens/instructions
CREATE TABLE public.whatsapp_agent_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt_type TEXT NOT NULL DEFAULT 'instruction', -- 'instruction', 'persona', 'rule', 'context'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = more important
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_agent_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own prompts"
ON public.whatsapp_agent_prompts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompts"
ON public.whatsapp_agent_prompts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
ON public.whatsapp_agent_prompts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
ON public.whatsapp_agent_prompts
FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX idx_whatsapp_agent_prompts_user_id ON public.whatsapp_agent_prompts(user_id);
CREATE INDEX idx_whatsapp_agent_prompts_active ON public.whatsapp_agent_prompts(user_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_agent_prompts_updated_at
BEFORE UPDATE ON public.whatsapp_agent_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comment on table
COMMENT ON TABLE public.whatsapp_agent_prompts IS 'User-defined custom prompt tokens/instructions for the WhatsApp AI agent';