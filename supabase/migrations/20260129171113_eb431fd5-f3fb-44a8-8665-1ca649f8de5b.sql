-- Make receipts bucket public so getPublicUrl works
-- RLS policies still control who can upload/delete, but viewing is open
UPDATE storage.buckets SET public = true WHERE id = 'receipts';