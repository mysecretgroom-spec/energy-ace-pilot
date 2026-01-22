-- Add metadata column to clients table for AI-extracted information
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add metadata column to rdv table for AI-extracted information
ALTER TABLE public.rdv 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add index for faster queries on metadata
CREATE INDEX IF NOT EXISTS idx_clients_metadata ON public.clients USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_rdv_metadata ON public.rdv USING gin(metadata);

-- Add comment for documentation
COMMENT ON COLUMN public.clients.metadata IS 'AI-extracted data from emails: situation_familiale, proprietaire, type_habitation, surface_habitable, etc.';
COMMENT ON COLUMN public.rdv.metadata IS 'AI-extracted data: motivation, budget_estime, urgence, type_toiture, orientation_toiture, etc.';