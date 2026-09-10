CREATE TABLE public.commission_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  regie_id uuid REFERENCES public.regies(id) ON DELETE CASCADE,
  product_type text,
  gamme text,
  nom text NOT NULL,
  description text,
  effet text NOT NULL DEFAULT 'deduction' CHECK (effet IN ('deduction','bonus','remplace_base')),
  base text NOT NULL DEFAULT 'fixe' CHECK (base IN ('fixe','montant_ht','montant_ttc','commission_base','prime_coup_pouce','surcouts','decom','puissance_kwc')),
  mode_valeur text NOT NULL DEFAULT 'fixe' CHECK (mode_valeur IN ('fixe','pourcentage')),
  valeur numeric NOT NULL DEFAULT 0,
  part_appliquee_pct numeric NOT NULL DEFAULT 100,
  condition_min numeric,
  condition_max numeric,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel','ia_texte','ia_vocal','ia_document')),
  source_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_rules_user ON public.commission_rules(user_id);
CREATE INDEX idx_commission_rules_regie ON public.commission_rules(regie_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own commission rules"
ON public.commission_rules FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_commission_rules_updated_at
BEFORE UPDATE ON public.commission_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();