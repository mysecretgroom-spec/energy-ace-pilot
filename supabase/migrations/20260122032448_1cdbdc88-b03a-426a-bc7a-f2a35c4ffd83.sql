-- Add commission_hejja column to data_prix_bouquets
ALTER TABLE public.data_prix_bouquets 
ADD COLUMN IF NOT EXISTS commission_hejja numeric DEFAULT 0;