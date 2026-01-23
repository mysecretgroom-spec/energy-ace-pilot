-- Create plaid_syncs table to track sync history and enforce rate limits
CREATE TABLE public.plaid_syncs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transactions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plaid_syncs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync history
CREATE POLICY "Users can view their own plaid syncs"
ON public.plaid_syncs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own sync records
CREATE POLICY "Users can insert their own plaid syncs"
ON public.plaid_syncs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient querying by user and date
CREATE INDEX idx_plaid_syncs_user_date ON public.plaid_syncs(user_id, synced_at DESC);