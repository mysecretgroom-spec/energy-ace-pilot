-- Table pour tracker les emails Gmail déjà importés
CREATE TABLE public.gmail_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender_email TEXT,
  subject TEXT,
  rdv_id UUID REFERENCES public.rdv(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'error', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

-- Enable RLS
ALTER TABLE public.gmail_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own imports" ON public.gmail_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imports" ON public.gmail_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_gmail_imports_user_message ON public.gmail_imports(user_id, gmail_message_id);
CREATE INDEX idx_gmail_imports_created ON public.gmail_imports(user_id, created_at DESC);