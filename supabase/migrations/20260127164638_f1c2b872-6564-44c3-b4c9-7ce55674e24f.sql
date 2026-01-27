-- Table prix énergies fossiles (partagée PAC/ITE)
CREATE TABLE public.data_energies_prix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_energie TEXT NOT NULL, -- 'gaz', 'fioul', 'propane', 'bois_buche', 'granules'
  prix_kwh NUMERIC NOT NULL DEFAULT 0.10,
  unite TEXT NOT NULL DEFAULT 'kWh', -- ou 'litre', 'kg', 'stère'
  pouvoir_calorifique_kwh NUMERIC, -- kWh par unité (ex: 10 kWh/litre pour fioul)
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table zones climatiques DJU (partagée PAC/ITE)
CREATE TABLE public.data_zones_climatiques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_code TEXT NOT NULL,
  department_name TEXT NOT NULL,
  zone_climatique TEXT NOT NULL, -- H1a, H1b, H1c, H2a, H2b, H2c, H2d, H3
  dju_base18 INTEGER NOT NULL, -- Degrés-jours unifiés base 18°C
  altitude_moyenne INTEGER,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table aides PAC (MaPrimeRénov, CEE)
CREATE TABLE public.data_aides_pac (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  type_aide TEXT NOT NULL, -- 'mpr', 'cee', 'tva', 'locale'
  profil_revenus TEXT, -- 'tres_modeste', 'modeste', 'intermediaire', 'superieur'
  pac_subtype TEXT, -- 'air_air', 'air_eau', 'geothermie', NULL pour tous
  montant_fixe NUMERIC,
  montant_plafond NUMERIC,
  conditions TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table aides ITE (MaPrimeRénov, CEE)
CREATE TABLE public.data_aides_ite (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  type_aide TEXT NOT NULL, -- 'mpr', 'cee', 'tva', 'locale'
  profil_revenus TEXT, -- 'tres_modeste', 'modeste', 'intermediaire', 'superieur'
  montant_m2 NUMERIC,
  montant_plafond NUMERIC,
  surface_min NUMERIC,
  conditions TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table types de murs existants (pour ITE)
CREATE TABLE public.data_ite_murs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_mur TEXT NOT NULL, -- 'parpaing', 'brique_creuse', 'brique_pleine', 'pierre', 'beton', 'ossature_bois'
  epaisseur_cm INTEGER,
  r_initial NUMERIC NOT NULL, -- Résistance thermique avant isolation
  u_initial NUMERIC NOT NULL, -- Coefficient de transmission thermique W/m².K
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table économies ITE par amélioration R
CREATE TABLE public.data_ite_economies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gain_r_min NUMERIC NOT NULL, -- Gain de R minimum
  gain_r_max NUMERIC NOT NULL, -- Gain de R maximum
  economie_chauffage_pct NUMERIC NOT NULL, -- % d'économie sur le chauffage
  zone_climatique TEXT, -- NULL = toutes zones, sinon H1, H2, H3
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_energies_prix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_zones_climatiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_aides_pac ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_aides_ite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_ite_murs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_ite_economies ENABLE ROW LEVEL SECURITY;

-- Policies for data_energies_prix
CREATE POLICY "Users can read all energies prix" ON public.data_energies_prix FOR SELECT USING (true);
CREATE POLICY "Users can insert own energies prix" ON public.data_energies_prix FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own energies prix" ON public.data_energies_prix FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own energies prix" ON public.data_energies_prix FOR DELETE USING (auth.uid() = user_id);

-- Policies for data_zones_climatiques
CREATE POLICY "Users can read all zones climatiques" ON public.data_zones_climatiques FOR SELECT USING (true);
CREATE POLICY "Users can insert own zones climatiques" ON public.data_zones_climatiques FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own zones climatiques" ON public.data_zones_climatiques FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own zones climatiques" ON public.data_zones_climatiques FOR DELETE USING (auth.uid() = user_id);

-- Policies for data_aides_pac
CREATE POLICY "Users can read all aides pac" ON public.data_aides_pac FOR SELECT USING (true);
CREATE POLICY "Users can insert own aides pac" ON public.data_aides_pac FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aides pac" ON public.data_aides_pac FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own aides pac" ON public.data_aides_pac FOR DELETE USING (auth.uid() = user_id);

-- Policies for data_aides_ite
CREATE POLICY "Users can read all aides ite" ON public.data_aides_ite FOR SELECT USING (true);
CREATE POLICY "Users can insert own aides ite" ON public.data_aides_ite FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aides ite" ON public.data_aides_ite FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own aides ite" ON public.data_aides_ite FOR DELETE USING (auth.uid() = user_id);

-- Policies for data_ite_murs
CREATE POLICY "Users can read all ite murs" ON public.data_ite_murs FOR SELECT USING (true);
CREATE POLICY "Users can insert own ite murs" ON public.data_ite_murs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ite murs" ON public.data_ite_murs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ite murs" ON public.data_ite_murs FOR DELETE USING (auth.uid() = user_id);

-- Policies for data_ite_economies
CREATE POLICY "Users can read all ite economies" ON public.data_ite_economies FOR SELECT USING (true);
CREATE POLICY "Users can insert own ite economies" ON public.data_ite_economies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ite economies" ON public.data_ite_economies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ite economies" ON public.data_ite_economies FOR DELETE USING (auth.uid() = user_id);