
-- Table for consumption estimator reference coefficients
-- Stores: ECS per person, base electricity, appliance defaults, heating coefficients
CREATE TABLE public.data_estimateur_coefficients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categorie TEXT NOT NULL,         -- 'ecs', 'base_elec', 'chauffage', 'appareil'
  code TEXT NOT NULL,              -- unique key: 'ecs_electrique', 'piscine_kwh_m3', etc.
  label TEXT NOT NULL,
  valeur NUMERIC NOT NULL DEFAULT 0,
  unite TEXT NOT NULL DEFAULT 'kWh',
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_estimateur_coefficients ENABLE ROW LEVEL SECURITY;

-- RLS: read global + own
CREATE POLICY "Read global or own estimateur coefficients"
  ON public.data_estimateur_coefficients FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

-- RLS: insert own
CREATE POLICY "Insert own estimateur coefficients"
  ON public.data_estimateur_coefficients FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS: update own
CREATE POLICY "Update own estimateur coefficients"
  ON public.data_estimateur_coefficients FOR UPDATE
  USING (user_id = auth.uid());

-- RLS: delete own
CREATE POLICY "Delete own estimateur coefficients"
  ON public.data_estimateur_coefficients FOR DELETE
  USING (user_id = auth.uid());

-- Seed global default data
INSERT INTO public.data_estimateur_coefficients (categorie, code, label, valeur, unite, description) VALUES
  -- ECS per person per year
  ('ecs', 'ecs_electrique', 'ECS Électrique', 800, 'kWh/pers/an', 'Ballon électrique classique'),
  ('ecs', 'ecs_gaz', 'ECS Gaz', 900, 'kWh/pers/an', 'Chauffe-eau gaz'),
  ('ecs', 'ecs_fioul', 'ECS Fioul', 950, 'kWh/pers/an', 'Chauffe-eau fioul'),
  ('ecs', 'ecs_thermodynamique', 'ECS Thermodynamique', 400, 'kWh/pers/an', 'Ballon thermodynamique (COP ~3)'),
  ('ecs', 'ecs_propane', 'ECS Propane', 900, 'kWh/pers/an', 'Chauffe-eau propane'),
  
  -- Base electricity per person
  ('base_elec', 'base_elec_personne', 'Électricité de base / personne', 1100, 'kWh/pers/an', 'Éclairage, électroménager, multimédia, etc.'),
  
  -- Appliance reference values
  ('appareil', 'piscine_kwh_m3', 'Piscine - conso par m³', 90, 'kWh/m³/an', 'Filtration + chauffage piscine'),
  ('appareil', 'jacuzzi_base_kwh', 'Jacuzzi/Spa - conso base (3kW)', 2500, 'kWh/an', 'Base pour puissance 3 kW'),
  ('appareil', 'sauna_sessions_semaine', 'Sauna - sessions / semaine', 3, 'sessions', 'Nombre moyen de sessions'),
  ('appareil', 'sauna_duree_h', 'Sauna - durée session', 1, 'h', 'Durée moyenne par session'),
  ('appareil', 've_kwh_100km', 'Véhicule élec - conso / 100 km', 18, 'kWh/100km', 'Consommation moyenne VE'),
  ('appareil', 've_perte_charge_pct', 'Véhicule élec - pertes charge', 10, '%', 'Pertes lors de la charge à domicile'),
  ('appareil', 'clim_heures_an', 'Climatisation - heures / an', 600, 'h/an', 'Durée moyenne de fonctionnement'),
  ('appareil', 'clim_seer', 'Climatisation - SEER moyen', 4, '', 'Coefficient de performance saisonnier');
