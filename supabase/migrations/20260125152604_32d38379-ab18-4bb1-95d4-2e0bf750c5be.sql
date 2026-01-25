-- Fix RLS policies to be more specific (service role bypass anyway)
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role can insert WhatsApp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Service role can update WhatsApp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.whatsapp_conversations;

-- These tables are primarily managed by Edge Functions using service role
-- which bypasses RLS. Users can only read their own data.
-- No insert/update/delete policies needed for regular users.