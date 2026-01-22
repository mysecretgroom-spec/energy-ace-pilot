-- Supprimer les anciennes politiques permissives sur data_aides
DROP POLICY IF EXISTS "Authenticated users can insert data_aides" ON data_aides;
DROP POLICY IF EXISTS "Authenticated users can update data_aides" ON data_aides;
DROP POLICY IF EXISTS "Authenticated users can delete data_aides" ON data_aides;

-- Créer des politiques admin-only pour data_aides
CREATE POLICY "Admins can insert data_aides" ON data_aides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_aides" ON data_aides
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_aides" ON data_aides
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Supprimer les anciennes politiques permissives sur data_financements
DROP POLICY IF EXISTS "Authenticated users can insert data_financements" ON data_financements;
DROP POLICY IF EXISTS "Authenticated users can update data_financements" ON data_financements;
DROP POLICY IF EXISTS "Authenticated users can delete data_financements" ON data_financements;

-- Créer des politiques admin-only pour data_financements
CREATE POLICY "Admins can insert data_financements" ON data_financements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_financements" ON data_financements
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_financements" ON data_financements
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Supprimer les anciennes politiques permissives sur data_tarifs_revente
DROP POLICY IF EXISTS "Authenticated users can insert data_tarifs_revente" ON data_tarifs_revente;
DROP POLICY IF EXISTS "Authenticated users can update data_tarifs_revente" ON data_tarifs_revente;
DROP POLICY IF EXISTS "Authenticated users can delete data_tarifs_revente" ON data_tarifs_revente;

-- Créer des politiques admin-only pour data_tarifs_revente
CREATE POLICY "Admins can insert data_tarifs_revente" ON data_tarifs_revente
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_tarifs_revente" ON data_tarifs_revente
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_tarifs_revente" ON data_tarifs_revente
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));