-- Add is_hejja column to regies table
ALTER TABLE public.regies ADD COLUMN IF NOT EXISTS is_hejja boolean DEFAULT false;

-- Add is_retape column to ventes table
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS is_retape boolean DEFAULT false;

-- Add aides_manuelles column to etudes table to store custom/modified aids
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS aides_manuelles jsonb DEFAULT NULL;

-- Add index for filtering non-retape ventes
CREATE INDEX IF NOT EXISTS idx_ventes_is_retape ON public.ventes(is_retape) WHERE is_retape = true;

-- Add index for filtering hejja regies
CREATE INDEX IF NOT EXISTS idx_regies_is_hejja ON public.regies(is_hejja) WHERE is_hejja = true;

COMMENT ON COLUMN public.regies.is_hejja IS 'If true, this regie is only visible when HEJJA mode is active';
COMMENT ON COLUMN public.ventes.is_retape IS 'If true, this sale is a retry/retape and excluded from normal stats';
COMMENT ON COLUMN public.etudes.aides_manuelles IS 'JSON array of manually modified or added aids for HEJJA mode';