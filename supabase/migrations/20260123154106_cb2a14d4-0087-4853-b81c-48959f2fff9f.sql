-- Add commission configuration columns to regies table
ALTER TABLE public.regies 
ADD COLUMN IF NOT EXISTS mode_calcul_commission TEXT DEFAULT 'bouquet' CHECK (mode_calcul_commission IN ('pourcentage', 'bouquet')),
ADD COLUMN IF NOT EXISTS part_survente_pct NUMERIC DEFAULT 50;

-- Add comment for documentation
COMMENT ON COLUMN public.regies.mode_calcul_commission IS 'Mode de calcul: pourcentage (tranches) ou bouquet (fixe + survente)';
COMMENT ON COLUMN public.regies.part_survente_pct IS 'Pourcentage de la survente reversée au commercial';