ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE public.commission_rules
    ADD CONSTRAINT commission_rules_statut_check
    CHECK (statut IN ('brouillon','actif','archive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_commission_rules_statut ON public.commission_rules(user_id, statut);

CREATE TABLE IF NOT EXISTS public.commission_schema_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  schema_nom TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  raisonnement TEXT,
  source_prompt TEXT,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT commission_schema_versions_statut_check CHECK (statut IN ('brouillon','actif','archive'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_schema_versions TO authenticated;
GRANT ALL ON public.commission_schema_versions TO service_role;

ALTER TABLE public.commission_schema_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage their own commission schema versions"
    ON public.commission_schema_versions FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_commission_schema_versions_user
  ON public.commission_schema_versions(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_commission_schema_versions_updated_at ON public.commission_schema_versions;
CREATE TRIGGER update_commission_schema_versions_updated_at
  BEFORE UPDATE ON public.commission_schema_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();