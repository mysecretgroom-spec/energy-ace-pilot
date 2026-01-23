
-- Ajouter user_id aux tables DATA pour permettre des surcharges personnalisées
-- Les enregistrements avec user_id = NULL sont les valeurs globales par défaut
-- Les enregistrements avec user_id = UUID sont les surcharges personnalisées

-- data_aides
ALTER TABLE public.data_aides ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_calibres  
ALTER TABLE public.data_calibres ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_commissions
ALTER TABLE public.data_commissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_compteurs
ALTER TABLE public.data_compteurs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_financements
ALTER TABLE public.data_financements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_orientation
ALTER TABLE public.data_orientation ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_prix_bouquets
ALTER TABLE public.data_prix_bouquets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_surcouts
ALTER TABLE public.data_surcouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- data_tarifs_revente
ALTER TABLE public.data_tarifs_revente ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Supprimer les anciennes politiques RLS et en créer de nouvelles

-- ============ data_aides ============
DROP POLICY IF EXISTS "Admins can delete data_aides" ON public.data_aides;
DROP POLICY IF EXISTS "Admins can insert data_aides" ON public.data_aides;
DROP POLICY IF EXISTS "Admins can update data_aides" ON public.data_aides;
DROP POLICY IF EXISTS "Authenticated users can read data_aides" ON public.data_aides;

CREATE POLICY "Users can read global or own data_aides" ON public.data_aides
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_aides" ON public.data_aides
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_aides" ON public.data_aides
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_aides" ON public.data_aides
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_aides" ON public.data_aides
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_calibres ============
DROP POLICY IF EXISTS "Admins can delete data_calibres" ON public.data_calibres;
DROP POLICY IF EXISTS "Admins can insert data_calibres" ON public.data_calibres;
DROP POLICY IF EXISTS "Admins can update data_calibres" ON public.data_calibres;
DROP POLICY IF EXISTS "Authenticated users can read data_calibres" ON public.data_calibres;

CREATE POLICY "Users can read global or own data_calibres" ON public.data_calibres
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_calibres" ON public.data_calibres
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_calibres" ON public.data_calibres
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_calibres" ON public.data_calibres
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_calibres" ON public.data_calibres
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_commissions ============
DROP POLICY IF EXISTS "Admins can delete data_commissions" ON public.data_commissions;
DROP POLICY IF EXISTS "Admins can insert data_commissions" ON public.data_commissions;
DROP POLICY IF EXISTS "Admins can update data_commissions" ON public.data_commissions;
DROP POLICY IF EXISTS "Authenticated users can read data_commissions" ON public.data_commissions;

CREATE POLICY "Users can read global or own data_commissions" ON public.data_commissions
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_commissions" ON public.data_commissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_commissions" ON public.data_commissions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_commissions" ON public.data_commissions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_commissions" ON public.data_commissions
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_compteurs ============
DROP POLICY IF EXISTS "Admins can delete data_compteurs" ON public.data_compteurs;
DROP POLICY IF EXISTS "Admins can insert data_compteurs" ON public.data_compteurs;
DROP POLICY IF EXISTS "Admins can update data_compteurs" ON public.data_compteurs;
DROP POLICY IF EXISTS "Authenticated users can read data_compteurs" ON public.data_compteurs;

CREATE POLICY "Users can read global or own data_compteurs" ON public.data_compteurs
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_compteurs" ON public.data_compteurs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_compteurs" ON public.data_compteurs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_compteurs" ON public.data_compteurs
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_compteurs" ON public.data_compteurs
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_financements ============
DROP POLICY IF EXISTS "Admins can delete data_financements" ON public.data_financements;
DROP POLICY IF EXISTS "Admins can insert data_financements" ON public.data_financements;
DROP POLICY IF EXISTS "Admins can update data_financements" ON public.data_financements;
DROP POLICY IF EXISTS "Authenticated users can read financements" ON public.data_financements;

CREATE POLICY "Users can read global or own data_financements" ON public.data_financements
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_financements" ON public.data_financements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_financements" ON public.data_financements
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_financements" ON public.data_financements
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_financements" ON public.data_financements
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_orientation ============
DROP POLICY IF EXISTS "Admins can delete data_orientation" ON public.data_orientation;
DROP POLICY IF EXISTS "Admins can insert data_orientation" ON public.data_orientation;
DROP POLICY IF EXISTS "Admins can update data_orientation" ON public.data_orientation;
DROP POLICY IF EXISTS "Authenticated users can read data_orientation" ON public.data_orientation;

CREATE POLICY "Users can read global or own data_orientation" ON public.data_orientation
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_orientation" ON public.data_orientation
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_orientation" ON public.data_orientation
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_orientation" ON public.data_orientation
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_orientation" ON public.data_orientation
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_prix_bouquets ============
DROP POLICY IF EXISTS "Admins can delete data_prix_bouquets" ON public.data_prix_bouquets;
DROP POLICY IF EXISTS "Admins can insert data_prix_bouquets" ON public.data_prix_bouquets;
DROP POLICY IF EXISTS "Admins can update data_prix_bouquets" ON public.data_prix_bouquets;
DROP POLICY IF EXISTS "Authenticated users can read data_prix_bouquets" ON public.data_prix_bouquets;

CREATE POLICY "Users can read global or own data_prix_bouquets" ON public.data_prix_bouquets
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_prix_bouquets" ON public.data_prix_bouquets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_prix_bouquets" ON public.data_prix_bouquets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_prix_bouquets" ON public.data_prix_bouquets
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_prix_bouquets" ON public.data_prix_bouquets
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_surcouts ============
DROP POLICY IF EXISTS "Admins can delete data_surcouts" ON public.data_surcouts;
DROP POLICY IF EXISTS "Admins can insert data_surcouts" ON public.data_surcouts;
DROP POLICY IF EXISTS "Admins can update data_surcouts" ON public.data_surcouts;
DROP POLICY IF EXISTS "Authenticated users can read data_surcouts" ON public.data_surcouts;

CREATE POLICY "Users can read global or own data_surcouts" ON public.data_surcouts
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_surcouts" ON public.data_surcouts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_surcouts" ON public.data_surcouts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_surcouts" ON public.data_surcouts
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_surcouts" ON public.data_surcouts
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

-- ============ data_tarifs_revente ============
DROP POLICY IF EXISTS "Admins can delete data_tarifs_revente" ON public.data_tarifs_revente;
DROP POLICY IF EXISTS "Admins can insert data_tarifs_revente" ON public.data_tarifs_revente;
DROP POLICY IF EXISTS "Admins can update data_tarifs_revente" ON public.data_tarifs_revente;
DROP POLICY IF EXISTS "Authenticated users can read data_tarifs_revente" ON public.data_tarifs_revente;

CREATE POLICY "Users can read global or own data_tarifs_revente" ON public.data_tarifs_revente
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own data_tarifs_revente" ON public.data_tarifs_revente
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data_tarifs_revente" ON public.data_tarifs_revente
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own data_tarifs_revente" ON public.data_tarifs_revente
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage global data_tarifs_revente" ON public.data_tarifs_revente
  FOR ALL USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));
