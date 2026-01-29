-- Create staging-uploads bucket for temporary file storage before validation
-- Files are stored here until user confirms the document type, then moved to final bucket

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('staging-uploads', 'staging-uploads', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for staging-uploads bucket
-- Users can only access their own files (path starts with their user_id)

CREATE POLICY "Users can upload to their own staging folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'staging-uploads' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can view their own staging files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'staging-uploads' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can delete their own staging files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'staging-uploads' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- Add staging_storage_path column to pending_documents table to track temporary location
ALTER TABLE public.pending_documents 
ADD COLUMN IF NOT EXISTS staging_storage_path TEXT;

-- Add workflow_type column to distinguish between document vs facture workflows
ALTER TABLE public.pending_documents 
ADD COLUMN IF NOT EXISTS workflow_type TEXT CHECK (workflow_type IN ('document_client', 'facture', 'unknown'));

-- Add confirmed_type column for user-validated document type
ALTER TABLE public.pending_documents 
ADD COLUMN IF NOT EXISTS confirmed_type TEXT;

-- Add final_bucket column to track where the file should be moved after validation
ALTER TABLE public.pending_documents 
ADD COLUMN IF NOT EXISTS final_bucket TEXT;

-- Update status enum to include new staging states
-- Note: existing status values from memory: 'pending', 'awaiting_confirmation', 'auto_assigned', 'manually_assigned', 'rejected'
-- Adding: 'staging' for initial upload, 'type_confirmed' for after type validation

COMMENT ON COLUMN public.pending_documents.workflow_type IS 'Identifies the workflow: document_client (CNI, RIB, etc.) or facture (expense receipts)';
COMMENT ON COLUMN public.pending_documents.staging_storage_path IS 'Temporary path in staging-uploads bucket before validation';
COMMENT ON COLUMN public.pending_documents.confirmed_type IS 'User-confirmed document type after AI suggestion';
COMMENT ON COLUMN public.pending_documents.final_bucket IS 'Target bucket after validation: documents or receipts';