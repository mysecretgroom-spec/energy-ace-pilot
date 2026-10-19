CREATE INDEX IF NOT EXISTS idx_rdv_user_date ON public.rdv (user_id, date_heure DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_client_date ON public.rdv (client_id, date_heure DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_images_expires ON public.whatsapp_pending_images (expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_images_created ON public.whatsapp_pending_images (created_at);
CREATE INDEX IF NOT EXISTS idx_google_sync_history_created ON public.google_sync_history (created_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_user_status_created ON public.background_jobs (user_id, status, created_at DESC);