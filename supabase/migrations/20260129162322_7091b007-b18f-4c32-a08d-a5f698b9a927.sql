
-- =====================================================
-- SECURITY FIX: Remove all public anonymous access policies
-- =====================================================

-- 1. data_aides_ite - Remove public access, keep authenticated only
DROP POLICY IF EXISTS "Users can read all aides ite" ON public.data_aides_ite;

-- 2. data_aides_pac - Remove public access
DROP POLICY IF EXISTS "Users can read all aides pac" ON public.data_aides_pac;

-- 3. data_energies_prix - Remove public access
DROP POLICY IF EXISTS "Users can read all energies prix" ON public.data_energies_prix;

-- 4. data_ite_economies - Remove public access
DROP POLICY IF EXISTS "Users can read all ite economies" ON public.data_ite_economies;

-- 5. data_ite_murs - Remove public access
DROP POLICY IF EXISTS "Users can read all ite murs" ON public.data_ite_murs;

-- 6. data_pac_isolation - Remove public access
DROP POLICY IF EXISTS "Lecture publique data_pac_isolation" ON public.data_pac_isolation;

-- 7. data_zones_climatiques - Remove public access
DROP POLICY IF EXISTS "Users can read all zones climatiques" ON public.data_zones_climatiques;

-- 8. pending_documents - Fix the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert pending documents" ON public.pending_documents;

-- Create proper policy for service role only (edge functions use service role key)
-- This policy requires authenticated user OR is accessed via service role
CREATE POLICY "Authenticated users can insert pending documents"
ON public.pending_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
