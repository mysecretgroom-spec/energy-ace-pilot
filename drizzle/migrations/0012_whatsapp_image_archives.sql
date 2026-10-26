CREATE TABLE public.whatsapp_image_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  image_count integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_image_archives TO authenticated;
GRANT ALL ON public.whatsapp_image_archives TO service_role;
ALTER TABLE public.whatsapp_image_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own archives readable" ON public.whatsapp_image_archives FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_wa_archives_user ON public.whatsapp_image_archives (user_id, created_at DESC);
CREATE POLICY "Own whatsapp archives download" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-archives' AND (storage.foldername(name))[1] = auth.uid()::text);