-- 1) Cleanup any currently-stuck "pending" images older than 10 minutes
UPDATE public.whatsapp_pending_images
SET status = 'expired'
WHERE status = 'pending'
  AND created_at < (now() - interval '10 minutes');

-- 2) Cleanup any stuck pending_action workflow older than 30 minutes
--    (these are workflows the user abandoned without responding)
UPDATE public.whatsapp_conversations
SET pending_action = NULL
WHERE pending_action IS NOT NULL
  AND last_message_at < (now() - interval '30 minutes');

-- 3) Add a partial index to speed up the recency filter used by fetchPendingImages
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_images_user_pending_recent
  ON public.whatsapp_pending_images (user_id, created_at DESC)
  WHERE status = 'pending';