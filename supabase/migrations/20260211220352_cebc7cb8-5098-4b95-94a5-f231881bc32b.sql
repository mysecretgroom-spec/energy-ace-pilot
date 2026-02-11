
-- Add parent_rdv_id to track R2/reporté chains
ALTER TABLE public.rdv ADD COLUMN parent_rdv_id UUID REFERENCES public.rdv(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_rdv_parent_rdv_id ON public.rdv(parent_rdv_id) WHERE parent_rdv_id IS NOT NULL;
