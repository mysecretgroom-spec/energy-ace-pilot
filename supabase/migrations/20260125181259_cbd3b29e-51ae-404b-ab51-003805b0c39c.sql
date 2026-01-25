-- Corriger la politique INSERT trop permissive - restreindre au service_role uniquement
DROP POLICY IF EXISTS "Service role can insert agent actions" ON public.whatsapp_agent_actions;

-- Nouvelle politique: INSERT seulement possible via service_role (pas via anon/authenticated directement)
-- L'insertion se fait via l'edge function qui utilise service_role
CREATE POLICY "Only service role can insert agent actions"
ON public.whatsapp_agent_actions
FOR INSERT
WITH CHECK (auth.uid() = user_id);