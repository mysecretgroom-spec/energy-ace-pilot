-- Add objectif_frais column to objectifs table
ALTER TABLE public.objectifs 
ADD COLUMN IF NOT EXISTS objectif_frais NUMERIC DEFAULT 500;