-- Create table for sync history
CREATE TABLE public.google_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'import', -- 'import' or 'export'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
  events_imported INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_exported INTEGER DEFAULT 0,
  events_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sync history"
ON public.google_sync_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync history"
ON public.google_sync_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync history"
ON public.google_sync_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_google_sync_history_user_date ON public.google_sync_history(user_id, created_at DESC);