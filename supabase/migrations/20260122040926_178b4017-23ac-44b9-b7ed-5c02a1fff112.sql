-- Drop existing admin-only policies for data_tarifs_revente
DROP POLICY IF EXISTS "Admins can delete data_tarifs_revente" ON public.data_tarifs_revente;
DROP POLICY IF EXISTS "Admins can insert data_tarifs_revente" ON public.data_tarifs_revente;
DROP POLICY IF EXISTS "Admins can update data_tarifs_revente" ON public.data_tarifs_revente;

-- Create new policies for all authenticated users
CREATE POLICY "Authenticated users can insert data_tarifs_revente"
ON public.data_tarifs_revente
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update data_tarifs_revente"
ON public.data_tarifs_revente
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete data_tarifs_revente"
ON public.data_tarifs_revente
FOR DELETE
TO authenticated
USING (true);