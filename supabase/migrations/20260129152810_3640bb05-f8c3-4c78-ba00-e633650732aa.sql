
-- Drop conflicting legacy policy that uses wrong index
DROP POLICY IF EXISTS "Users can read their own receipts" ON storage.objects;

-- Verify consistent policies for 'documents' bucket (they seem correct, just verifying)
-- The documents bucket policies are correct, checking if upload works with path user_id/...

-- For completeness, let's ensure all buckets have correct policies by recreating clean ones

-- Documents bucket: ensure all operations use foldername[1] = auth.uid()
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "documents_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documents_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documents_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "documents_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
