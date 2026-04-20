-- Buffer for WhatsApp screenshots awaiting batch RDV extraction
CREATE TABLE IF NOT EXISTS public.whatsapp_pending_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  image_data TEXT NOT NULL, -- base64 data URL or storage URL
  mime_type TEXT DEFAULT 'image/jpeg',
  regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | extracted | validated | discarded
  extracted_rdvs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_images_user_phone
  ON public.whatsapp_pending_images (user_id, phone_number, status, created_at DESC);

ALTER TABLE public.whatsapp_pending_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending images"
  ON public.whatsapp_pending_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pending images"
  ON public.whatsapp_pending_images FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);