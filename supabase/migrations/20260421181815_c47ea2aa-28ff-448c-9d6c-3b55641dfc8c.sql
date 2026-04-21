UPDATE public.whatsapp_pending_images
SET status = 'cleared'
WHERE user_id = '6fb326ff-526a-41d9-a697-4f159556a846'
  AND status = 'pending';

UPDATE public.whatsapp_conversations
SET pending_action = NULL,
    pending_message_sids = '{}'::jsonb
WHERE user_id = '6fb326ff-526a-41d9-a697-4f159556a846'
  AND pending_action IS NOT NULL;