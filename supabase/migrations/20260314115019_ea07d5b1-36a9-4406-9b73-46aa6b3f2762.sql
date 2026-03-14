
CREATE TABLE public.data_evolution_prix_energie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_energie TEXT NOT NULL,
  taux_augmentation_annuel NUMERIC NOT NULL DEFAULT 4,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_evolution_prix_energie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global or own evolution data"
  ON public.data_evolution_prix_energie FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own evolution data"
  ON public.data_evolution_prix_energie FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own evolution data"
  ON public.data_evolution_prix_energie FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own evolution data"
  ON public.data_evolution_prix_energie FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Seed default data
INSERT INTO public.data_evolution_prix_energie (type_energie, taux_augmentation_annuel, description) VALUES
  ('electricite', 4.0, 'Hausse moyenne constatee ~4%/an (CRE, historique 2015-2025)'),
  ('gaz', 6.0, 'Hausse moyenne constatee ~6%/an (gaz naturel, forte volatilite)'),
  ('fioul', 5.0, 'Hausse moyenne constatee ~5%/an (fioul domestique, lie au petrole)'),
  ('propane', 4.5, 'Hausse moyenne constatee ~4.5%/an'),
  ('bois', 2.5, 'Hausse moderee ~2.5%/an (energie bois/granules)');
