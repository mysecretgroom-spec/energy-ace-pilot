-- Create storage bucket for etudes PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('etudes-pdf', 'etudes-pdf', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for etudes-pdf bucket
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'etudes-pdf' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'etudes-pdf' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'etudes-pdf' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add pdf_url column to etudes table for storing latest PDF reference
ALTER TABLE public.etudes 
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;