ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS gamme text;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS gamme_id uuid REFERENCES public.regies_gammes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ventes_gamme_id_idx ON public.ventes (gamme_id);