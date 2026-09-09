CREATE TABLE IF NOT EXISTS public.regies_gammes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  regie_id uuid NOT NULL REFERENCES public.regies(id) ON DELETE CASCADE,
  product_type text NOT NULL DEFAULT 'PV',
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regies_gammes TO authenticated;
GRANT ALL ON public.regies_gammes TO service_role;

ALTER TABLE public.regies_gammes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view regies_gammes"
  ON public.regies_gammes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.regies r WHERE r.id = regies_gammes.regie_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can create their own regies_gammes"
  ON public.regies_gammes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own regies_gammes"
  ON public.regies_gammes FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own regies_gammes"
  ON public.regies_gammes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS regies_gammes_unique_nom ON public.regies_gammes (regie_id, product_type, lower(nom));

ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS gamme_id uuid REFERENCES public.regies_gammes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bouquets_gamme_id_idx ON public.bouquets (gamme_id);