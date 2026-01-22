-- Table pour stocker les tokens Google OAuth
CREATE TABLE public.google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  scopes text[] DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own tokens
CREATE POLICY "Users can view own tokens"
ON public.google_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
ON public.google_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
ON public.google_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
ON public.google_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();