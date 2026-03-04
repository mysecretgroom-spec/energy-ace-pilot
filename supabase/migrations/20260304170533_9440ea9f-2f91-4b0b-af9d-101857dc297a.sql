ALTER TYPE public.vente_status ADD VALUE IF NOT EXISTS 'inFinancable';
ALTER TYPE public.vente_status ADD VALUE IF NOT EXISTS 'retracte';
ALTER TYPE public.vente_status ADD VALUE IF NOT EXISTS 'refus_mairie_abf';