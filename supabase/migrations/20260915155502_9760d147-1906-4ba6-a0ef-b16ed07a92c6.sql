ALTER TABLE public.whatsapp_agent_memory
  ADD COLUMN IF NOT EXISTS regie_id uuid REFERENCES public.regies(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_agent_memory
  DROP CONSTRAINT IF EXISTS whatsapp_agent_memory_scope_check;

ALTER TABLE public.whatsapp_agent_memory
  ADD CONSTRAINT whatsapp_agent_memory_scope_check CHECK (
    (scope = 'user' AND user_id IS NOT NULL AND regie_id IS NULL)
    OR (scope = 'global' AND user_id IS NULL AND regie_id IS NULL)
    OR (scope = 'regie' AND user_id IS NOT NULL AND regie_id IS NOT NULL)
  );

ALTER TABLE public.whatsapp_agent_memory
  DROP CONSTRAINT IF EXISTS whatsapp_agent_memory_user_id_memory_type_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agent_memory_user_unique
  ON public.whatsapp_agent_memory (user_id, memory_type, key)
  WHERE scope = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agent_memory_regie_unique
  ON public.whatsapp_agent_memory (user_id, regie_id, memory_type, key)
  WHERE scope = 'regie';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_agent_memory_global_unique
  ON public.whatsapp_agent_memory (memory_type, key)
  WHERE scope = 'global';

CREATE INDEX IF NOT EXISTS whatsapp_agent_memory_regie_idx
  ON public.whatsapp_agent_memory (regie_id) WHERE regie_id IS NOT NULL;