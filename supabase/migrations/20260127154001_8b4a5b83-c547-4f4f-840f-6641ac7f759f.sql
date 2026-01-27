-- Table des niveaux d'isolation pour calcul des besoins thermiques PAC
CREATE TABLE public.data_pac_isolation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  niveau_isolation TEXT NOT NULL,  -- 'tres_mauvais', 'mauvais', 'moyen', 'bon', 'tres_bon', 'rt2012', 'rt2020'
  label TEXT NOT NULL,             -- Label affiché
  coefficient_deperdition NUMERIC NOT NULL, -- W/m².K (ex: 1.2, 0.9, 0.6...)
  besoins_kwh_m2_an NUMERIC NOT NULL,       -- kWh/m²/an pour chauffage
  description TEXT,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID
);

-- Enable RLS
ALTER TABLE public.data_pac_isolation ENABLE ROW LEVEL SECURITY;

-- Policy for read access (public data)
CREATE POLICY "Lecture publique data_pac_isolation" ON public.data_pac_isolation
  FOR SELECT USING (true);

-- Policy for user-specific data management
CREATE POLICY "Users can manage their own isolation data" ON public.data_pac_isolation
  FOR ALL USING (auth.uid() = user_id);

-- Insert default isolation levels
INSERT INTO public.data_pac_isolation (niveau_isolation, label, coefficient_deperdition, besoins_kwh_m2_an, description, ordre) VALUES
  ('tres_mauvais', 'Très mauvais (avant 1974)', 2.5, 250, 'Aucune isolation, simple vitrage', 1),
  ('mauvais', 'Mauvais (1974-1982)', 1.8, 180, 'Isolation légère, double vitrage ancien', 2),
  ('moyen', 'Moyen (1982-2000)', 1.2, 120, 'Isolation correcte, double vitrage', 3),
  ('bon', 'Bon (2000-2012)', 0.8, 80, 'Bonne isolation, DV performant', 4),
  ('tres_bon', 'Très bon (RT2012)', 0.5, 50, 'Excellente isolation thermique', 5),
  ('rt2020', 'RT2020/RE2020', 0.3, 30, 'Maison passive ou basse consommation', 6);

-- Add new fields to etudes table for PAC energy calculations
ALTER TABLE public.etudes 
  ADD COLUMN IF NOT EXISTS pac_niveau_isolation TEXT,
  ADD COLUMN IF NOT EXISTS pac_prix_kwh_elec NUMERIC,
  ADD COLUMN IF NOT EXISTS pac_besoins_chauffage_kwh NUMERIC,
  ADD COLUMN IF NOT EXISTS pac_conso_elec_pac_kwh NUMERIC,
  ADD COLUMN IF NOT EXISTS pac_surcout_elec_euros NUMERIC,
  ADD COLUMN IF NOT EXISTS pac_economie_nette_euros NUMERIC;