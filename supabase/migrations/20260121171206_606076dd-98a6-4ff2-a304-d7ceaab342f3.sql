-- ================================================
-- TABLES DATA PARAMÉTRABLES (référentiels)
-- ================================================

-- Table PSH (Peak Sun Hours) par département
CREATE TABLE public.data_psh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_code VARCHAR(3) NOT NULL UNIQUE,
  department_name VARCHAR(100) NOT NULL,
  psh_value DECIMAL(4,2) NOT NULL DEFAULT 4.0,
  max_psh_value DECIMAL(4,2) NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table coefficients orientation/inclinaison
CREATE TABLE public.data_orientation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orientation VARCHAR(20) NOT NULL,
  inclinaison INTEGER NOT NULL,
  coefficient DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(orientation, inclinaison)
);

-- Table tarifs revente électricité
CREATE TABLE public.data_tarifs_revente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_revente VARCHAR(50) NOT NULL,
  puissance_min DECIMAL(5,2) NOT NULL DEFAULT 0,
  puissance_max DECIMAL(5,2) NOT NULL DEFAULT 999,
  prix_kwh DECIMAL(6,4) NOT NULL,
  date_effet DATE NOT NULL DEFAULT CURRENT_DATE,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table prix bouquets/installations
CREATE TABLE public.data_prix_bouquets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_bouquet VARCHAR(100) NOT NULL,
  puissance_kwc DECIMAL(5,2) NOT NULL,
  prix_recommande DECIMAL(10,2) NOT NULL,
  prix_max DECIMAL(10,2) NOT NULL,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table surcoûts options
CREATE TABLE public.data_surcouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prix DECIMAL(10,2) NOT NULL,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table commissions
CREATE TABLE public.data_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tranche_min DECIMAL(10,2) NOT NULL DEFAULT 0,
  tranche_max DECIMAL(10,2) NOT NULL DEFAULT 999999,
  taux_commission DECIMAL(5,2) NOT NULL,
  bonus_survente DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- PROFILS UTILISATEURS
-- ================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  zone_geographique VARCHAR(100),
  avatar_url TEXT,
  pin_code VARCHAR(6),
  biometric_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- CLIENTS
-- ================================================

CREATE TYPE public.rdv_status AS ENUM (
  'nouveau', 'reporte', 'r2', 'r2_prestudy', 'signe', 'negatif', 'annule'
);

CREATE TYPE public.project_type AS ENUM (
  'photovoltaique', 'pompe_chaleur', 'isolation', 'ballon_thermo', 'autre'
);

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100),
  email VARCHAR(255),
  telephone VARCHAR(20),
  telephone_secondaire VARCHAR(20),
  adresse TEXT,
  code_postal VARCHAR(10),
  ville VARCHAR(100),
  notes TEXT,
  source VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- RENDEZ-VOUS
-- ================================================

CREATE TABLE public.rdv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_heure TIMESTAMPTZ NOT NULL,
  duree_minutes INTEGER DEFAULT 90,
  adresse TEXT,
  type_projet project_type NOT NULL DEFAULT 'photovoltaique',
  status rdv_status NOT NULL DEFAULT 'nouveau',
  commentaire TEXT,
  email_source_id TEXT,
  historique JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- ÉTUDES COMMERCIALES
-- ================================================

CREATE TYPE public.etude_verdict AS ENUM ('valide', 'a_etudier', 'invalide');

CREATE TABLE public.etudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rdv_id UUID REFERENCES public.rdv(id) ON DELETE SET NULL,
  
  -- Infos consommation
  consommation_annuelle_kwh DECIMAL(10,2),
  facture_annuelle_euros DECIMAL(10,2),
  
  -- Installation proposée
  puissance_kwc DECIMAL(5,2),
  nombre_panneaux INTEGER,
  type_revente VARCHAR(50) DEFAULT 'surplus',
  
  -- Infos techniques
  support VARCHAR(50),
  orientation VARCHAR(20),
  inclinaison INTEGER,
  
  -- Photos (URLs stockage)
  photo_compteur TEXT,
  photo_tableau TEXT,
  photo_toiture TEXT,
  photo_inclinaison TEXT,
  
  -- Calculs
  production_annuelle_kwh DECIMAL(10,2),
  autoconsommation_kwh DECIMAL(10,2),
  autoconsommation_pct DECIMAL(5,2),
  revente_kwh DECIMAL(10,2),
  gain_autoconso_euros DECIMAL(10,2),
  revente_euros DECIMAL(10,2),
  gain_total_annuel DECIMAL(10,2),
  
  -- Prix
  prix_installation DECIMAL(10,2),
  surcouts JSONB DEFAULT '[]'::jsonb,
  prix_total DECIMAL(10,2),
  mensualite_estimee DECIMAL(10,2),
  duree_financement_mois INTEGER DEFAULT 180,
  
  -- Résultat
  resultat_mensuel DECIMAL(10,2),
  verdict etude_verdict,
  
  -- Mode interne HEJJA
  mode_hejja_psh BOOLEAN DEFAULT false,
  mode_hejja_prix BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- DOCUMENTS
-- ================================================

CREATE TYPE public.document_type AS ENUM (
  'cni', 'justificatif_domicile', 'facture_energie', 'bon_commande', 'devis', 'autre'
);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  etude_id UUID REFERENCES public.etudes(id) ON DELETE SET NULL,
  type_document document_type NOT NULL DEFAULT 'autre',
  nom VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  taille_bytes BIGINT,
  mime_type VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- HISTORIQUE ACTIONS
-- ================================================

CREATE TABLE public.historique_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rdv_id UUID REFERENCES public.rdv(id) ON DELETE SET NULL,
  etude_id UUID REFERENCES public.etudes(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- EMAILS AUTORISÉS (pour import RDV)
-- ================================================

CREATE TABLE public.emails_autorises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  nom_source VARCHAR(100),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- ================================================
-- FRAIS
-- ================================================

CREATE TYPE public.frais_categorie AS ENUM (
  'carburant', 'peage', 'repas', 'hotel', 'parking', 'autre'
);

CREATE TABLE public.frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_frais DATE NOT NULL DEFAULT CURRENT_DATE,
  categorie frais_categorie NOT NULL,
  description VARCHAR(255),
  montant DECIMAL(10,2) NOT NULL,
  justificatif_url TEXT,
  ocr_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own clients"
  ON public.clients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RDV
ALTER TABLE public.rdv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rdv"
  ON public.rdv FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Études
ALTER TABLE public.etudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own etudes"
  ON public.etudes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own documents"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Historique
ALTER TABLE public.historique_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own historique"
  ON public.historique_actions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Emails autorisés
ALTER TABLE public.emails_autorises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own emails_autorises"
  ON public.emails_autorises FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Frais
ALTER TABLE public.frais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own frais"
  ON public.frais FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tables DATA (lecture seule pour tous les utilisateurs authentifiés)
ALTER TABLE public.data_psh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_orientation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_tarifs_revente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_prix_bouquets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_surcouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read data_psh"
  ON public.data_psh FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read data_orientation"
  ON public.data_orientation FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read data_tarifs_revente"
  ON public.data_tarifs_revente FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read data_prix_bouquets"
  ON public.data_prix_bouquets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read data_surcouts"
  ON public.data_surcouts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read data_commissions"
  ON public.data_commissions FOR SELECT TO authenticated USING (true);

-- ================================================
-- TRIGGER UPDATED_AT
-- ================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rdv_updated_at
  BEFORE UPDATE ON public.rdv
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_etudes_updated_at
  BEFORE UPDATE ON public.etudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_psh_updated_at
  BEFORE UPDATE ON public.data_psh
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_prix_bouquets_updated_at
  BEFORE UPDATE ON public.data_prix_bouquets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- TRIGGER AUTO-CREATE PROFILE
-- ================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- DONNÉES INITIALES (référentiels)
-- ================================================

-- PSH par département (exemples)
INSERT INTO public.data_psh (department_code, department_name, psh_value, max_psh_value) VALUES
('01', 'Ain', 3.8, 4.5),
('13', 'Bouches-du-Rhône', 4.8, 5.5),
('31', 'Haute-Garonne', 4.2, 5.0),
('33', 'Gironde', 4.0, 4.8),
('34', 'Hérault', 4.7, 5.4),
('44', 'Loire-Atlantique', 3.7, 4.4),
('59', 'Nord', 3.2, 4.0),
('69', 'Rhône', 4.0, 4.8),
('75', 'Paris', 3.5, 4.2),
('83', 'Var', 4.9, 5.6),
('84', 'Vaucluse', 4.6, 5.3);

-- Coefficients orientation/inclinaison
INSERT INTO public.data_orientation (orientation, inclinaison, coefficient) VALUES
('Sud', 0, 0.93), ('Sud', 15, 0.97), ('Sud', 30, 1.00), ('Sud', 45, 0.97), ('Sud', 60, 0.88),
('Sud-Est', 0, 0.93), ('Sud-Est', 15, 0.95), ('Sud-Est', 30, 0.96), ('Sud-Est', 45, 0.93), ('Sud-Est', 60, 0.84),
('Sud-Ouest', 0, 0.93), ('Sud-Ouest', 15, 0.95), ('Sud-Ouest', 30, 0.96), ('Sud-Ouest', 45, 0.93), ('Sud-Ouest', 60, 0.84),
('Est', 0, 0.93), ('Est', 15, 0.90), ('Est', 30, 0.87), ('Est', 45, 0.81), ('Est', 60, 0.72),
('Ouest', 0, 0.93), ('Ouest', 15, 0.90), ('Ouest', 30, 0.87), ('Ouest', 45, 0.81), ('Ouest', 60, 0.72);

-- Tarifs revente (T4 2025)
INSERT INTO public.data_tarifs_revente (type_revente, puissance_min, puissance_max, prix_kwh, date_effet) VALUES
('surplus', 0, 3, 0.1313, '2025-01-01'),
('surplus', 3, 9, 0.1120, '2025-01-01'),
('surplus', 9, 36, 0.0761, '2025-01-01'),
('totale', 0, 3, 0.1735, '2025-01-01'),
('totale', 3, 9, 0.1474, '2025-01-01');

-- Prix bouquets
INSERT INTO public.data_prix_bouquets (nom_bouquet, puissance_kwc, prix_recommande, prix_max, description) VALUES
('Essentiel 3kWc', 3.0, 7500, 9000, '8 panneaux, onduleur, installation complète'),
('Confort 6kWc', 6.0, 12000, 15000, '16 panneaux, onduleur, installation complète'),
('Performance 9kWc', 9.0, 16000, 20000, '24 panneaux, onduleur, installation complète'),
('Premium 12kWc', 12.0, 20000, 25000, '32 panneaux, onduleur, installation complète');

-- Surcoûts options
INSERT INTO public.data_surcouts (code, nom, prix, description) VALUES
('TRI_PHASÉ', 'Passage triphasé', 800, 'Adaptation installation triphasée'),
('CARPORT', 'Carport solaire', 4500, 'Structure carport avec panneaux'),
('BAC_GSE', 'Bac acier GSE', 1200, 'Support bac acier intégré'),
('BATTERIE_5', 'Batterie 5kWh', 3500, 'Stockage batterie lithium 5kWh'),
('BATTERIE_10', 'Batterie 10kWh', 6000, 'Stockage batterie lithium 10kWh'),
('DOMOTIQUE', 'Pack domotique', 500, 'Monitoring et pilotage intelligent');

-- Commissions
INSERT INTO public.data_commissions (tranche_min, tranche_max, taux_commission, bonus_survente) VALUES
(0, 10000, 8.0, 0),
(10000, 15000, 10.0, 2.0),
(15000, 20000, 12.0, 3.0),
(20000, 999999, 15.0, 5.0);