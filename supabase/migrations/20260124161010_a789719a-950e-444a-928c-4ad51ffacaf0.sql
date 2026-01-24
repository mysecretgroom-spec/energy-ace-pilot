-- Add type_calcul column to regies_surcouts to differentiate fixed vs variable surcharges
ALTER TABLE public.regies_surcouts 
ADD COLUMN IF NOT EXISTS type_calcul text NOT NULL DEFAULT 'fixe';

-- Add a comment for documentation
COMMENT ON COLUMN public.regies_surcouts.type_calcul IS 'Type de calcul: fixe (forfait unique) ou par_panneau (prix x nombre panneaux)';

-- Update existing bac_gse entries to be per-panel
UPDATE public.regies_surcouts 
SET type_calcul = 'par_panneau' 
WHERE code ILIKE '%bac_gse%';