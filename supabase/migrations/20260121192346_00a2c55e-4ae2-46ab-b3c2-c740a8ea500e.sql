-- ===========================================
-- 1. ENUM pour les statuts de vente
-- ===========================================
CREATE TYPE public.vente_status AS ENUM (
  'en_negociation',
  'signe',
  'en_installation',
  'installe',
  'paye',
  'annule'
);

-- ===========================================
-- 2. TABLE VENTES - Suivi des contrats
-- ===========================================
CREATE TABLE public.ventes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  etude_id UUID REFERENCES public.etudes(id) ON DELETE SET NULL,
  
  -- Infos contrat
  numero_contrat VARCHAR,
  date_signature DATE,
  date_installation_prevue DATE,
  date_installation_reelle DATE,
  date_paiement DATE,
  
  -- Montants
  montant_ht NUMERIC NOT NULL,
  montant_ttc NUMERIC NOT NULL,
  montant_acompte NUMERIC DEFAULT 0,
  montant_solde NUMERIC,
  
  -- Détails installation
  puissance_kwc NUMERIC,
  nombre_panneaux INTEGER,
  type_installation VARCHAR,
  
  -- Status
  status vente_status NOT NULL DEFAULT 'en_negociation',
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own ventes" ON public.ventes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_ventes_updated_at BEFORE UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 3. TABLE COMMISSIONS - Suivi des gains
-- ===========================================
CREATE TABLE public.commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
  
  -- Calcul
  montant_base NUMERIC NOT NULL,
  taux_commission NUMERIC NOT NULL,
  bonus_survente NUMERIC DEFAULT 0,
  montant_commission NUMERIC NOT NULL,
  
  -- Paiement
  date_calcul DATE NOT NULL DEFAULT CURRENT_DATE,
  date_paiement DATE,
  paye BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own commissions" ON public.commissions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===========================================
-- 4. TABLE OBJECTIFS - Targets commerciaux
-- ===========================================
CREATE TABLE public.objectifs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Période
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  annee INTEGER NOT NULL,
  
  -- Objectifs
  objectif_ca NUMERIC DEFAULT 0,
  objectif_ventes INTEGER DEFAULT 0,
  objectif_rdv INTEGER DEFAULT 0,
  
  -- Réalisé (calculé dynamiquement mais peut être stocké pour historique)
  realise_ca NUMERIC DEFAULT 0,
  realise_ventes INTEGER DEFAULT 0,
  realise_rdv INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, mois, annee)
);

-- RLS
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own objectifs" ON public.objectifs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_objectifs_updated_at BEFORE UPDATE ON public.objectifs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 5. TABLE NOTIFICATIONS
-- ===========================================
CREATE TYPE public.notification_type AS ENUM (
  'rappel_rdv',
  'relance_client',
  'commission_paye',
  'objectif_atteint',
  'nouveau_rdv',
  'vente_signee',
  'installation_prevue',
  'autre'
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Contenu
  type notification_type NOT NULL,
  titre VARCHAR NOT NULL,
  message TEXT NOT NULL,
  
  -- Références optionnelles
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  rdv_id UUID REFERENCES public.rdv(id) ON DELETE CASCADE,
  vente_id UUID REFERENCES public.ventes(id) ON DELETE CASCADE,
  
  -- État
  lue BOOLEAN DEFAULT false,
  date_lecture TIMESTAMP WITH TIME ZONE,
  
  -- Planification
  date_envoi TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index pour les notifications non lues
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, lue) WHERE lue = false;