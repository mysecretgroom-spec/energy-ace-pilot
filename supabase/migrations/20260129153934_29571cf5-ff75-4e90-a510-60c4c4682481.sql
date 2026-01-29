-- Le problème est que storage.objects nécessite aussi une politique UPDATE avec WITH CHECK
-- car Supabase Storage fait un INSERT puis un UPDATE

-- Recréer la politique UPDATE avec WITH CHECK
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;

CREATE POLICY "documents_update_own" ON storage.objects
FOR UPDATE TO public
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);