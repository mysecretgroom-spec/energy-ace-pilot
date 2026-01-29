-- FIX: Ensure storage policies for documents bucket cover all operations correctly
-- The createSignedUrl operation requires SELECT permission

-- First, let's drop and recreate the policies with proper permissions
-- Making sure the SELECT policy works for the authenticated role

-- Drop existing documents policies to recreate them cleanly
DROP POLICY IF EXISTS "documents_user_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_delete" ON storage.objects;

-- Recreate with explicit role TO clause and proper conditions
-- SELECT policy - allows reading files in user's folder
CREATE POLICY "documents_user_select" 
ON storage.objects FOR SELECT 
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT policy - allows uploading to user's folder
CREATE POLICY "documents_user_insert" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE policy - allows updating files in user's folder
CREATE POLICY "documents_user_update" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE policy - allows deleting files in user's folder
CREATE POLICY "documents_user_delete" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Also ensure receipts bucket has the same proper policies
DROP POLICY IF EXISTS "receipts_user_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_delete" ON storage.objects;

CREATE POLICY "receipts_user_select" 
ON storage.objects FOR SELECT 
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_user_insert" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_user_update" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "receipts_user_delete" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);