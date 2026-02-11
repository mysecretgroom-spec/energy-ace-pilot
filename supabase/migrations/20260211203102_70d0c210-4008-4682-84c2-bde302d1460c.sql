-- Fix: Make documents bucket public so existing public URLs work for download/preview
UPDATE storage.buckets SET public = true WHERE id = 'documents';