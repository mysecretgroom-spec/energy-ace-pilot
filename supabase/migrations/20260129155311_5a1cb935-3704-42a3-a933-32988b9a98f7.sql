
-- =====================================================
-- HARMONISATION DES POLITIQUES RLS POUR LE BUCKET "receipts"
-- Même convention que "documents": {user_id}/...
-- =====================================================

-- 1. Supprimer les anciennes politiques du bucket receipts
DROP POLICY IF EXISTS "Users can view own receipts storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own receipts storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own receipts storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts storage" ON storage.objects;

-- 2. Créer des politiques RLS robustes pour le bucket "receipts"
-- Convention de chemin: {user_id}/... 
-- Le premier segment du chemin DOIT être l'ID de l'utilisateur authentifié

-- SELECT: Utilisateurs peuvent lire leurs propres fichiers
CREATE POLICY "receipts_user_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- INSERT: Utilisateurs peuvent uploader dans leur propre dossier
CREATE POLICY "receipts_user_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- UPDATE: Utilisateurs peuvent modifier leurs propres fichiers (avec WITH CHECK pour les uploads multi-step)
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

-- DELETE: Utilisateurs peuvent supprimer leurs propres fichiers
CREATE POLICY "receipts_user_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
