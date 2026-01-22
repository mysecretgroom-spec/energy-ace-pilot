-- Add columns for Google Calendar sync
ALTER TABLE public.rdv 
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rdv_google_event_id ON public.rdv(google_event_id) WHERE google_event_id IS NOT NULL;

-- Add source column to clients table for tracking origin
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';