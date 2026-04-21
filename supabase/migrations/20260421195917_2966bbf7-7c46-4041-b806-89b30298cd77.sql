-- Remove orphan document row whose Storage object is empty (0 bytes).
-- The DB row claims 5.7 MB but the Storage HEAD returns content-length: 0.
-- This was caused by a bad raw-blob upload that returned 200 without persisting bytes.
DELETE FROM public.documents
WHERE id = '86b3b849-12d2-43c2-83de-a7c5af4979f8';