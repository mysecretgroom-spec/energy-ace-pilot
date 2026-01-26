-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION MULTI-PRODUITS (PAC / ITE / PV)
-- Phase 1: Structure de base pour support multi-produits
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Créer l'ENUM pour les types de produits
CREATE TYPE public.product_type AS ENUM ('PV', 'PAC', 'ITE');

-- 2. Créer l'ENUM pour les sous-types PAC
CREATE TYPE public.pac_subtype AS ENUM ('air_air', 'air_eau');

-- ═══════════════════════════════════════════════════════════════════════════
-- MODIFICATION TABLE ETUDES
-- ═══════════════════════════════════════════════════════════════════════════

-- Ajouter le type de produit aux études (PV par défaut pour rétrocompatibilité)
ALTER TABLE public.etudes 
  ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'PV';

-- Marquer toutes les études existantes comme PV
UPDATE public.etudes SET product_type = 'PV' WHERE product_type IS NULL;

-- Champs spécifiques PAC
ALTER TABLE public.etudes 
  ADD COLUMN IF NOT EXISTS pac_subtype public.pac_subtype,
  ADD COLUMN IF NOT EXISTS pac_surface_chauffee numeric,
  ADD COLUMN IF NOT EXISTS pac_type_emetteurs text,
  ADD COLUMN IF NOT EXISTS pac_nombre_unites_int integer,
  ADD COLUMN IF NOT EXISTS pac_puissance_calorifique numeric,
  ADD COLUMN IF NOT EXISTS pac_cop numeric,
  ADD COLUMN IF NOT EXISTS pac_ecs_integre boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pac_volume_ballon integer,
  ADD COLUMN IF NOT EXISTS pac_energie_actuelle text,
  ADD COLUMN IF NOT EXISTS pac_conso_chauffage_kwh numeric,
  ADD COLUMN IF NOT EXISTS pac_economie_estimee numeric;

-- Champs spécifiques ITE
ALTER TABLE public.etudes 
  ADD COLUMN IF NOT EXISTS ite_surface_isoler numeric,
  ADD COLUMN IF NOT EXISTS ite_type_facade text,
  ADD COLUMN IF NOT EXISTS ite_epaisseur_isolant integer,
  ADD COLUMN IF NOT EXISTS ite_type_isolant text,
  ADD COLUMN IF NOT EXISTS ite_r_actuel numeric,
  ADD COLUMN IF NOT EXISTS ite_r_cible numeric,
  ADD COLUMN IF NOT EXISTS ite_nombre_facades integer,
  ADD COLUMN IF NOT EXISTS ite_surface_ouvertures numeric,
  ADD COLUMN IF NOT EXISTS ite_finition text,
  ADD COLUMN IF NOT EXISTS ite_economie_chauffage_pct numeric;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODIFICATION TABLE VENTES
-- ═══════════════════════════════════════════════════════════════════════════

-- Ajouter le type de produit aux ventes
ALTER TABLE public.ventes 
  ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'PV';

-- Marquer toutes les ventes existantes comme PV
UPDATE public.ventes SET product_type = 'PV' WHERE product_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODIFICATION TABLE REGIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Ajouter les produits proposés par régie (tableau de product_type)
ALTER TABLE public.regies 
  ADD COLUMN IF NOT EXISTS products_offered public.product_type[] DEFAULT ARRAY['PV']::public.product_type[];

-- Marquer les régies existantes avec PAC/ITE si elles existent déjà
-- (à adapter selon les données réelles)

-- ═══════════════════════════════════════════════════════════════════════════
-- MODIFICATION TABLE BOUQUETS
-- ═══════════════════════════════════════════════════════════════════════════

-- Ajouter le type de produit aux bouquets
ALTER TABLE public.bouquets 
  ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'PV';

-- Marquer tous les bouquets existants comme PV
UPDATE public.bouquets SET product_type = 'PV' WHERE product_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES PARAMÈTRES SPÉCIFIQUES PAC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.data_pac_cop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  pac_subtype public.pac_subtype NOT NULL,
  temperature_exterieure integer NOT NULL,
  cop_moyen numeric NOT NULL DEFAULT 3.5,
  actif boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_pac_cop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global or own data_pac_cop" ON public.data_pac_cop
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_pac_cop" ON public.data_pac_cop
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_pac_cop" ON public.data_pac_cop
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_pac_cop" ON public.data_pac_cop
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_pac_cop" ON public.data_pac_cop
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- Table des puissances PAC recommandées par surface
CREATE TABLE IF NOT EXISTS public.data_pac_puissances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  pac_subtype public.pac_subtype NOT NULL,
  surface_min numeric NOT NULL,
  surface_max numeric NOT NULL,
  puissance_recommandee numeric NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_pac_puissances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global or own data_pac_puissances" ON public.data_pac_puissances
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_pac_puissances" ON public.data_pac_puissances
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_pac_puissances" ON public.data_pac_puissances
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_pac_puissances" ON public.data_pac_puissances
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_pac_puissances" ON public.data_pac_puissances
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES PARAMÈTRES SPÉCIFIQUES ITE
-- ═══════════════════════════════════════════════════════════════════════════

-- Table des coefficients R par type d'isolant
CREATE TABLE IF NOT EXISTS public.data_ite_isolants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type_isolant text NOT NULL,
  lambda numeric NOT NULL,
  prix_m2 numeric NOT NULL DEFAULT 0,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_ite_isolants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global or own data_ite_isolants" ON public.data_ite_isolants
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_ite_isolants" ON public.data_ite_isolants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_ite_isolants" ON public.data_ite_isolants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_ite_isolants" ON public.data_ite_isolants
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_ite_isolants" ON public.data_ite_isolants
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- Table des finitions ITE
CREATE TABLE IF NOT EXISTS public.data_ite_finitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type_finition text NOT NULL,
  prix_m2 numeric NOT NULL DEFAULT 0,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_ite_finitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global or own data_ite_finitions" ON public.data_ite_finitions
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_ite_finitions" ON public.data_ite_finitions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_ite_finitions" ON public.data_ite_finitions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_ite_finitions" ON public.data_ite_finitions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_ite_finitions" ON public.data_ite_finitions
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE COMMISSIONS PAR PRODUIT
-- ═══════════════════════════════════════════════════════════════════════════

-- Ajouter le product_type à la table data_commissions existante
ALTER TABLE public.data_commissions 
  ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'PV';

-- Marquer les commissions existantes comme PV
UPDATE public.data_commissions SET product_type = 'PV' WHERE product_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES POUR PERFORMANCES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_etudes_product_type ON public.etudes(product_type);
CREATE INDEX IF NOT EXISTS idx_ventes_product_type ON public.ventes(product_type);
CREATE INDEX IF NOT EXISTS idx_bouquets_product_type ON public.bouquets(product_type);
CREATE INDEX IF NOT EXISTS idx_data_commissions_product_type ON public.data_commissions(product_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES PAC
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.data_pac_cop (pac_subtype, temperature_exterieure, cop_moyen, user_id) VALUES
  ('air_eau', 7, 4.5, NULL),
  ('air_eau', 2, 3.5, NULL),
  ('air_eau', -7, 2.5, NULL),
  ('air_air', 7, 4.0, NULL),
  ('air_air', 2, 3.2, NULL),
  ('air_air', -7, 2.2, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.data_pac_puissances (pac_subtype, surface_min, surface_max, puissance_recommandee, user_id) VALUES
  ('air_eau', 0, 80, 6, NULL),
  ('air_eau', 80, 120, 8, NULL),
  ('air_eau', 120, 160, 11, NULL),
  ('air_eau', 160, 250, 14, NULL),
  ('air_air', 0, 20, 2.5, NULL),
  ('air_air', 20, 40, 3.5, NULL),
  ('air_air', 40, 60, 5, NULL),
  ('air_air', 60, 100, 7, NULL)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES ITE
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.data_ite_isolants (type_isolant, lambda, prix_m2, description, user_id) VALUES
  ('Polystyrène expansé (PSE)', 0.038, 25, 'Isolant classique, bon rapport qualité/prix', NULL),
  ('Polystyrène extrudé (XPS)', 0.032, 35, 'Résistant à l''humidité', NULL),
  ('Laine de roche', 0.035, 40, 'Bon isolant phonique, incombustible', NULL),
  ('Fibre de bois', 0.042, 55, 'Écologique, bon déphasage thermique', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.data_ite_finitions (type_finition, prix_m2, description, user_id) VALUES
  ('Enduit minéral', 30, 'Finition classique, plusieurs coloris', NULL),
  ('Enduit siloxane', 40, 'Hydrofuge, auto-nettoyant', NULL),
  ('Bardage bois', 60, 'Esthétique naturelle', NULL),
  ('Bardage composite', 80, 'Durable, peu d''entretien', NULL)
ON CONFLICT DO NOTHING;