-- Ajouter les champs pour lier un RDV à une étude et identifier les R2
ALTER TABLE public.rdv 
ADD COLUMN IF NOT EXISTS etude_id uuid REFERENCES public.etudes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_r2 boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS r2_type character varying DEFAULT NULL;

-- Créer un index pour les recherches
CREATE INDEX IF NOT EXISTS idx_rdv_etude ON public.rdv(etude_id);
CREATE INDEX IF NOT EXISTS idx_rdv_is_r2 ON public.rdv(is_r2) WHERE is_r2 = true;