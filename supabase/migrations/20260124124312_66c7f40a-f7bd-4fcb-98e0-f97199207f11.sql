-- Update reference tables to require authentication for SELECT

-- data_prix_bouquets: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_prix_bouquets" ON public.data_prix_bouquets;
CREATE POLICY "Authenticated users can read global or own data_prix_bouquets" 
ON public.data_prix_bouquets 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_commissions: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_commissions" ON public.data_commissions;
CREATE POLICY "Authenticated users can read global or own data_commissions" 
ON public.data_commissions 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_aides: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_aides" ON public.data_aides;
CREATE POLICY "Authenticated users can read global or own data_aides" 
ON public.data_aides 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_surcouts: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_surcouts" ON public.data_surcouts;
CREATE POLICY "Authenticated users can read global or own data_surcouts" 
ON public.data_surcouts 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_tarifs_revente: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_tarifs_revente" ON public.data_tarifs_revente;
CREATE POLICY "Authenticated users can read global or own data_tarifs_revente" 
ON public.data_tarifs_revente 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_financements: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_financements" ON public.data_financements;
CREATE POLICY "Authenticated users can read global or own data_financements" 
ON public.data_financements 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_calibres: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_calibres" ON public.data_calibres;
CREATE POLICY "Authenticated users can read global or own data_calibres" 
ON public.data_calibres 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_orientation: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_orientation" ON public.data_orientation;
CREATE POLICY "Authenticated users can read global or own data_orientation" 
ON public.data_orientation 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));

-- data_compteurs: Update SELECT policy to require auth
DROP POLICY IF EXISTS "Users can read global or own data_compteurs" ON public.data_compteurs;
CREATE POLICY "Authenticated users can read global or own data_compteurs" 
ON public.data_compteurs 
FOR SELECT 
TO authenticated
USING ((user_id IS NULL) OR (user_id = auth.uid()));