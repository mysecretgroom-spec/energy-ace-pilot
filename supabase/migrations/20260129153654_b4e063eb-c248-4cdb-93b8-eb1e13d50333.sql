-- Fix documents bucket RLS policies
-- The issue is that policies for 'documents' bucket use TO authenticated but might have incorrect checks

-- First, drop the existing policies
DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;

-- Recreate with correct syntax - using auth.uid() IS NOT NULL check first
CREATE POLICY "documents_select_own" ON storage.objects
FOR SELECT TO public
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_insert_own" ON storage.objects
FOR INSERT TO public
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_update_own" ON storage.objects
FOR UPDATE TO public
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_delete_own" ON storage.objects
FOR DELETE TO public
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);