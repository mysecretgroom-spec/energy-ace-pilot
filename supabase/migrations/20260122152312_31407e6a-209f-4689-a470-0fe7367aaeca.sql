-- Supprimer les politiques permissives restantes sur data_financements
DROP POLICY IF EXISTS "Authenticated users can insert financements" ON data_financements;
DROP POLICY IF EXISTS "Authenticated users can update financements" ON data_financements;
DROP POLICY IF EXISTS "Authenticated users can delete financements" ON data_financements;