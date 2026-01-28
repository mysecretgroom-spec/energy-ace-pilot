-- Sécuriser les tables de données de référence en exigeant une authentification

-- 1. Bouquets - Drop existing public policy and create authenticated-only
DROP POLICY IF EXISTS "Bouquets are viewable by everyone" ON public.bouquets;
DROP POLICY IF EXISTS "Anyone can view bouquets" ON public.bouquets;
DROP POLICY IF EXISTS "bouquets_select_policy" ON public.bouquets;

CREATE POLICY "Authenticated users can view bouquets"
ON public.bouquets
FOR SELECT
TO authenticated
USING (true);

-- 2. Regies Surcouts - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view regies_surcouts" ON public.regies_surcouts;
DROP POLICY IF EXISTS "regies_surcouts_select_policy" ON public.regies_surcouts;

CREATE POLICY "Authenticated users can view regies_surcouts"
ON public.regies_surcouts
FOR SELECT
TO authenticated
USING (true);

-- 3. Data PAC COP - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_pac_cop" ON public.data_pac_cop;
DROP POLICY IF EXISTS "data_pac_cop_select_policy" ON public.data_pac_cop;

CREATE POLICY "Authenticated users can view data_pac_cop"
ON public.data_pac_cop
FOR SELECT
TO authenticated
USING (true);

-- 4. Data PAC Puissances - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_pac_puissances" ON public.data_pac_puissances;
DROP POLICY IF EXISTS "data_pac_puissances_select_policy" ON public.data_pac_puissances;

CREATE POLICY "Authenticated users can view data_pac_puissances"
ON public.data_pac_puissances
FOR SELECT
TO authenticated
USING (true);

-- 5. Data ITE Isolants - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_ite_isolants" ON public.data_ite_isolants;
DROP POLICY IF EXISTS "data_ite_isolants_select_policy" ON public.data_ite_isolants;

CREATE POLICY "Authenticated users can view data_ite_isolants"
ON public.data_ite_isolants
FOR SELECT
TO authenticated
USING (true);

-- 6. Data ITE Economies - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_ite_economies" ON public.data_ite_economies;
DROP POLICY IF EXISTS "data_ite_economies_select_policy" ON public.data_ite_economies;

CREATE POLICY "Authenticated users can view data_ite_economies"
ON public.data_ite_economies
FOR SELECT
TO authenticated
USING (true);

-- 7. Data Energies Prix - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_energies_prix" ON public.data_energies_prix;
DROP POLICY IF EXISTS "data_energies_prix_select_policy" ON public.data_energies_prix;

CREATE POLICY "Authenticated users can view data_energies_prix"
ON public.data_energies_prix
FOR SELECT
TO authenticated
USING (true);

-- 8. Data Zones Climatiques - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_zones_climatiques" ON public.data_zones_climatiques;
DROP POLICY IF EXISTS "data_zones_climatiques_select_policy" ON public.data_zones_climatiques;

CREATE POLICY "Authenticated users can view data_zones_climatiques"
ON public.data_zones_climatiques
FOR SELECT
TO authenticated
USING (true);

-- 9. Data PAC Isolation - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_pac_isolation" ON public.data_pac_isolation;
DROP POLICY IF EXISTS "data_pac_isolation_select_policy" ON public.data_pac_isolation;

CREATE POLICY "Authenticated users can view data_pac_isolation"
ON public.data_pac_isolation
FOR SELECT
TO authenticated
USING (true);

-- 10. Data ITE Finitions - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_ite_finitions" ON public.data_ite_finitions;
DROP POLICY IF EXISTS "data_ite_finitions_select_policy" ON public.data_ite_finitions;

CREATE POLICY "Authenticated users can view data_ite_finitions"
ON public.data_ite_finitions
FOR SELECT
TO authenticated
USING (true);

-- 11. Data ITE Murs - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_ite_murs" ON public.data_ite_murs;
DROP POLICY IF EXISTS "data_ite_murs_select_policy" ON public.data_ite_murs;

CREATE POLICY "Authenticated users can view data_ite_murs"
ON public.data_ite_murs
FOR SELECT
TO authenticated
USING (true);

-- 12. Data Aides ITE - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_aides_ite" ON public.data_aides_ite;
DROP POLICY IF EXISTS "data_aides_ite_select_policy" ON public.data_aides_ite;

CREATE POLICY "Authenticated users can view data_aides_ite"
ON public.data_aides_ite
FOR SELECT
TO authenticated
USING (true);

-- 13. Data Aides PAC - Secure with authentication
DROP POLICY IF EXISTS "Anyone can view data_aides_pac" ON public.data_aides_pac;
DROP POLICY IF EXISTS "data_aides_pac_select_policy" ON public.data_aides_pac;

CREATE POLICY "Authenticated users can view data_aides_pac"
ON public.data_aides_pac
FOR SELECT
TO authenticated
USING (true);