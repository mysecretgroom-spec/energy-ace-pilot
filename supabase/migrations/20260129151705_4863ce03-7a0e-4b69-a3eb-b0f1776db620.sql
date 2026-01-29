-- Drop conflicting policies for receipts bucket
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;

-- Keep the policies that use foldername[1] = user_id (correct format)
-- Recreate consistent policies for receipts bucket

-- SELECT: user_id as first folder segment
CREATE POLICY "Users can view own receipts storage" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- INSERT: Check that user_id is first folder segment
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own receipts" ON storage.objects;
CREATE POLICY "Users can upload own receipts storage" 
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- UPDATE: user_id as first folder segment
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
CREATE POLICY "Users can update own receipts storage" 
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'receipts' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- DELETE: user_id as first folder segment
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;
CREATE POLICY "Users can delete own receipts storage" 
ON storage.objects FOR DELETE
USING (
  bucket_id = 'receipts' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);