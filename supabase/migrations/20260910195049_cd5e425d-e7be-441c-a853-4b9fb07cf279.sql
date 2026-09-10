ALTER TABLE public.etudes
  ADD COLUMN IF NOT EXISTS adresse_installation text,
  ADD COLUMN IF NOT EXISTS code_postal_installation text,
  ADD COLUMN IF NOT EXISTS ville_installation text;