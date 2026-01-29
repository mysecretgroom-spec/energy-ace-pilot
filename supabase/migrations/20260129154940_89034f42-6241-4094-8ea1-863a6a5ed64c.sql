-- =====================================================
-- AUDIT COMPLET ET RECREATION DES POLITIQUES RLS
-- Pour le bucket "documents" (stockage privé)
-- =====================================================

-- 1. Supprimer TOUTES les anciennes politiques du bucket documents
DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents storage" ON storage.objects;

-- 2. Créer des politiques RLS robustes pour le bucket "documents"
-- Convention de chemin: {user_id}/... 
-- Le premier segment du chemin DOIT être l'ID de l'utilisateur authentifié

-- SELECT: Utilisateurs peuvent lire leurs propres fichiers
CREATE POLICY "documents_user_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- INSERT: Utilisateurs peuvent uploader dans leur propre dossier
CREATE POLICY "documents_user_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- UPDATE: Utilisateurs peuvent modifier leurs propres fichiers
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

-- DELETE: Utilisateurs peuvent supprimer leurs propres fichiers
CREATE POLICY "documents_user_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);