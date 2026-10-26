CREATE TABLE public.drive_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  document_id uuid,
  etude_id uuid,
  source text NOT NULL DEFAULT 'document',
  file_name text NOT NULL,
  drive_file_id text,
  drive_link text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.drive_uploads TO authenticated;
GRANT ALL ON public.drive_uploads TO service_role;
ALTER TABLE public.drive_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own drive uploads readable" ON public.drive_uploads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX drive_uploads_user_created_idx ON public.drive_uploads (user_id, created_at DESC);