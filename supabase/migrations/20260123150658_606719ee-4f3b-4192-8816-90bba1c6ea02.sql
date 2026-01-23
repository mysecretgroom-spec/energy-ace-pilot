-- =====================================================
-- RÉGIES: Tables principales pour la gestion des sources RDV
-- =====================================================

-- Table principale des régies
CREATE TABLE public.regies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nom VARCHAR NOT NULL,
  couleur VARCHAR DEFAULT '#0066CC',
  logo_url TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contrainte d'unicité: un utilisateur ne peut pas avoir 2 régies avec le même nom
ALTER TABLE public.regies ADD CONSTRAINT regies_user_nom_unique UNIQUE (user_id, nom);

-- Enable RLS
ALTER TABLE public.regies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own regies"
ON public.regies
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_regies_updated_at
  BEFORE UPDATE ON public.regies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- REGIES_CONTACTS: Contacts WhatsApp par régie
-- =====================================================

CREATE TABLE public.regies_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regie_id UUID NOT NULL REFERENCES public.regies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nom VARCHAR NOT NULL,
  telephone VARCHAR NOT NULL,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regies_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own regies_contacts"
ON public.regies_contacts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_regies_contacts_updated_at
  BEFORE UPDATE ON public.regies_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- REGIES_BOUQUETS: Tarifs et commissions par régie
-- =====================================================

CREATE TABLE public.regies_bouquets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regie_id UUID NOT NULL REFERENCES public.regies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nom_bouquet VARCHAR NOT NULL,
  puissance_kwc NUMERIC NOT NULL,
  prix_recommande NUMERIC NOT NULL DEFAULT 0,
  prix_max NUMERIC NOT NULL DEFAULT 0,
  prix_hejja NUMERIC DEFAULT 0,
  commission_fixe NUMERIC DEFAULT 0,
  commission_pct NUMERIC DEFAULT 0,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regies_bouquets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own regies_bouquets"
ON public.regies_bouquets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_regies_bouquets_updated_at
  BEFORE UPDATE ON public.regies_bouquets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- MISE À JOUR: emails_autorises - Ajout lien vers régie
-- =====================================================

-- Ajouter colonne regie_id (nullable pour rétrocompatibilité)
ALTER TABLE public.emails_autorises 
  ADD COLUMN regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL;

-- =====================================================
-- MISE À JOUR: rdv - Ajout lien vers régie
-- =====================================================

ALTER TABLE public.rdv
  ADD COLUMN regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL;

-- Index pour filtrage rapide par régie
CREATE INDEX idx_rdv_regie_id ON public.rdv(regie_id);

-- =====================================================
-- MISE À JOUR: ventes - Ajout lien vers régie
-- =====================================================

ALTER TABLE public.ventes
  ADD COLUMN regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL;

-- Index pour filtrage rapide par régie
CREATE INDEX idx_ventes_regie_id ON public.ventes(regie_id);

-- =====================================================
-- MISE À JOUR: confirmateurs - Ajout lien vers régie (optionnel, pour migration future)
-- =====================================================

ALTER TABLE public.confirmateurs
  ADD COLUMN regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL;