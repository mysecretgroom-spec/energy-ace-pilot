
-- =====================================================
-- FIX: Ensure SELECT policy allows reading just-uploaded files
-- The issue is that createSignedUrl needs to SELECT the object
-- right after INSERT, and the policies must allow this
-- =====================================================

-- Drop and recreate documents policies to ensure proper order
-- and that they work correctly with authenticated role

-- First, verify documents bucket exists and is not public
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';

-- Drop all existing documents policies to start fresh
DROP POLICY IF EXISTS "documents_user_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_user_delete" ON storage.objects;

-- Also drop any legacy policies that might conflict
DROP POLICY IF EXISTS "Users can view own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents storage" ON storage.objects;

-- CREATE ROBUST POLICIES FOR DOCUMENTS BUCKET
-- Convention: {user_id}/... path structure

-- SELECT: Users can read their own files (needed for createSignedUrl)
CREATE POLICY "documents_user_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- Allow if first folder segment matches auth.uid()
    (storage.foldername(name))[1] = (auth.uid())::text
  )
);

-- INSERT: Users can upload to their own folder
CREATE POLICY "documents_user_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- UPDATE: Users can update their own files (for multi-part uploads)
CREATE POLICY "documents_user_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- DELETE: Users can delete their own files
CREATE POLICY "documents_user_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- =====================================================
-- ALSO FIX RECEIPTS BUCKET POLICIES (same structure)
-- =====================================================

DROP POLICY IF EXISTS "receipts_user_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_delete" ON storage.objects;

-- SELECT: Users can read their own receipts
CREATE POLICY "receipts_user_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- INSERT: Users can upload receipts
CREATE POLICY "receipts_user_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- UPDATE: Users can update receipts
CREATE POLICY "receipts_user_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- DELETE: Users can delete receipts
CREATE POLICY "receipts_user_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
