DROP POLICY IF EXISTS "Admins can delete pending documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read pending documents storage" ON storage.objects;
CREATE POLICY "Admins can read pending documents storage" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pending-documents' AND public.is_saas_admin(auth.uid()));
CREATE POLICY "Admins can delete pending documents storage" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pending-documents' AND public.is_saas_admin(auth.uid()));