CREATE TABLE public.config_ai_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domaine text NOT NULL,
  regie_id uuid,
  resume text,
  raisonnement text,
  source_prompt text,
  snapshot_avant jsonb NOT NULL DEFAULT '[]'::jsonb,
  changements jsonb NOT NULL DEFAULT '[]'::jsonb,
  statut text NOT NULL DEFAULT 'applique',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_ai_changes TO authenticated;
GRANT ALL ON public.config_ai_changes TO service_role;

ALTER TABLE public.config_ai_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own config changes"
  ON public.config_ai_changes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_config_ai_changes_user_domaine
  ON public.config_ai_changes (user_id, domaine, created_at DESC);

CREATE TRIGGER update_config_ai_changes_updated_at
  BEFORE UPDATE ON public.config_ai_changes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();