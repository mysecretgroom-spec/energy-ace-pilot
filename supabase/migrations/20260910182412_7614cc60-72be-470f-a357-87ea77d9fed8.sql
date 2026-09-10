ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS schema_nom text,
  ADD COLUMN IF NOT EXISTS raisonnement text,
  ADD COLUMN IF NOT EXISTS condition_base text NOT NULL DEFAULT 'montant_ht';

ALTER TABLE public.commission_rules
  DROP CONSTRAINT IF EXISTS commission_rules_condition_base_check;
ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_condition_base_check
  CHECK (condition_base IN ('montant_ht','montant_ttc','puissance_kwc'));

CREATE INDEX IF NOT EXISTS commission_rules_schema_idx
  ON public.commission_rules (user_id, schema_nom);