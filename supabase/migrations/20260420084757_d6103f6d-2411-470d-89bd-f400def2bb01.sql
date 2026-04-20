
-- Empêcher le listing direct des fichiers dans les buckets publics 'avatars' et 'videos'
-- Les URLs publiques individuelles (/object/public/) restent fonctionnelles.
-- Cette migration restreint la lecture brute (storage.objects SELECT) qui permettait le listing.

-- AVATARS : remplacer la policy "Avatars are publicly accessible" par une version qui n'autorise pas le listing root
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

CREATE POLICY "Avatars are publicly accessible (no listing)"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
  AND name IS NOT NULL
  AND name <> ''
  AND position('/' in name) > 0
);

-- VIDEOS : remplacer la policy "Anyone can view videos" idem
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;

CREATE POLICY "Anyone can view videos (no listing)"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'videos'
  AND name IS NOT NULL
  AND name <> ''
  AND position('/' in name) > 0
);
