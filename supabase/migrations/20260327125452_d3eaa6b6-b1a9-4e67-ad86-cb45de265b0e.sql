ALTER TABLE public.regies ADD COLUMN cout_panneau_supplementaire NUMERIC DEFAULT 500;

COMMENT ON COLUMN public.regies.cout_panneau_supplementaire IS 'Coût par panneau supplémentaire (en €) pour le calcul d''interpolation entre bouquets. Panneau = 500Wc.';