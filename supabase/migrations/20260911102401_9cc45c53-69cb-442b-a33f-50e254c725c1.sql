ALTER TABLE public.whatsapp_agent_memory
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'user';

ALTER TABLE public.whatsapp_agent_memory
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.whatsapp_agent_memory
  ADD CONSTRAINT whatsapp_agent_memory_scope_check
  CHECK (
    (scope = 'user' AND user_id IS NOT NULL)
    OR (scope = 'global' AND user_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agent_memory_global_key_idx
  ON public.whatsapp_agent_memory (memory_type, key)
  WHERE scope = 'global';

CREATE INDEX IF NOT EXISTS whatsapp_agent_memory_scope_idx
  ON public.whatsapp_agent_memory (scope);

CREATE POLICY "Authenticated can view global agent memories"
  ON public.whatsapp_agent_memory
  FOR SELECT
  TO authenticated
  USING (scope = 'global');

CREATE POLICY "Admins can manage global agent memories"
  ON public.whatsapp_agent_memory
  FOR ALL
  TO authenticated
  USING (scope = 'global' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (scope = 'global' AND public.has_role(auth.uid(), 'admin'));