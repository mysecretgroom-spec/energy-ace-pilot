-- Create data_aides table for subsidies configuration
CREATE TABLE public.data_aides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  nom VARCHAR NOT NULL,
  description TEXT,
  type_calcul VARCHAR NOT NULL DEFAULT 'par_kwc', -- 'par_kwc', 'pourcentage', 'fixe'
  valeur NUMERIC NOT NULL DEFAULT 0,
  puissance_min NUMERIC DEFAULT 0,
  puissance_max NUMERIC DEFAULT 999,
  conditions TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_aides ENABLE ROW LEVEL SECURITY;

-- Create policies for all authenticated users (collaborative management)
CREATE POLICY "Authenticated users can read data_aides"
ON public.data_aides
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert data_aides"
ON public.data_aides
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update data_aides"
ON public.data_aides
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete data_aides"
ON public.data_aides
FOR DELETE
TO authenticated
USING (true);

-- Insert default aids based on Excel model
INSERT INTO public.data_aides (code, nom, description, type_calcul, valeur, puissance_min, puissance_max, conditions) VALUES
('prime_autoconso', 'Prime autoconsommation', 'Prime versée pour les installations en autoconsommation avec vente du surplus', 'par_kwc', 80, 0, 9, 'Installation ≤ 9 kWc'),
('prime_autoconso_9_36', 'Prime autoconsommation 9-36 kWc', 'Prime pour installations moyennes', 'par_kwc', 60, 9, 36, 'Installation entre 9 et 36 kWc'),
('eco_tva', 'Éco TVA', 'Réduction TVA pour installations ≤ 3 kWc (TVA 10% au lieu de 20%)', 'pourcentage', 10, 0, 3, 'Installation ≤ 3 kWc, TVA réduite à 10%');