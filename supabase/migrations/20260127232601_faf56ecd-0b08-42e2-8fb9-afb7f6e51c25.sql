-- Add SIRET column to regies table
ALTER TABLE public.regies
ADD COLUMN IF NOT EXISTS siret TEXT;