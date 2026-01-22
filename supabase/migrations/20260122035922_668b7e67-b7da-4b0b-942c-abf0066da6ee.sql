-- Ajouter les champs manquants à la table etudes pour correspondre au modèle Excel

-- VISITE TECHNIQUE - TOITURE
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS ombre_toiture VARCHAR(50) DEFAULT '0 à 5%';
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS surface_toiture VARCHAR(50) DEFAULT 'OK';
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS type_toiture VARCHAR(50) DEFAULT 'TUILE';
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS etat_toiture VARCHAR(50) DEFAULT 'OK';

-- COMPTEUR ÉLECTRIQUE
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS type_compteur_electrique VARCHAR(50) DEFAULT 'Linky';
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS numero_pdl VARCHAR(50);
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS type_raccordement VARCHAR(50) DEFAULT 'MONOPHASÉ';

-- TABLEAU ÉLECTRIQUE
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS amperage_disjoncteur INTEGER;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS emplacement_boitier VARCHAR(100) DEFAULT 'À côté';

-- RÉSULTAT VISITE TECHNIQUE
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS potentiel_faisabilite VARCHAR(50) DEFAULT 'Faisable';

-- DONNÉES TECHNIQUES
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS surface_installation_m2 NUMERIC(10, 2);
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS rendement_productivite NUMERIC(5, 2) DEFAULT 100.00;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS surplus_production_kwh NUMERIC(10, 2);

-- PRÉ-ÉTUDE FINANCIÈRE - AIDES
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS prime_autoconsommation NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS eco_tva NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS total_aides NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS total_aides_deduites NUMERIC(10, 2);

-- FINANCEMENT
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS mode_financement VARCHAR(50) DEFAULT 'SOFINCO';
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS taux_financement NUMERIC(5, 2) DEFAULT 4.00;

-- RENTABILITÉ FINANCIÈRE
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS economie_autoconso_mensuelle NUMERIC(10, 2);
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS revente_mensuelle_estimee NUMERIC(10, 2);
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS resultat_transfert_charge NUMERIC(10, 2);

-- SURCOÛTS DÉTAILLÉS
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS surcout_support NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS surcout_compteur NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.etudes ADD COLUMN IF NOT EXISTS autre_surcout NUMERIC(10, 2) DEFAULT 0;