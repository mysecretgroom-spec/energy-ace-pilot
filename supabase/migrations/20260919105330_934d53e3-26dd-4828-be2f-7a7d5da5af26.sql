ALTER TABLE public.regies_financements
  ADD COLUMN IF NOT EXISTS mode_calcul text NOT NULL DEFAULT 'report_interets',
  ADD COLUMN IF NOT EXISTS duree_report_mois integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS frais_dossier_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calcul_auto boolean NOT NULL DEFAULT true;

ALTER TABLE public.regies_financements
  DROP CONSTRAINT IF EXISTS regies_financements_mode_calcul_check;

ALTER TABLE public.regies_financements
  ADD CONSTRAINT regies_financements_mode_calcul_check
  CHECK (mode_calcul IN ('report_interets', 'amortissement_direct'));

ALTER TABLE public.regies_financements
  DROP CONSTRAINT IF EXISTS regies_financements_duree_report_check;

ALTER TABLE public.regies_financements
  ADD CONSTRAINT regies_financements_duree_report_check
  CHECK (duree_report_mois >= 0 AND duree_report_mois <= 24);