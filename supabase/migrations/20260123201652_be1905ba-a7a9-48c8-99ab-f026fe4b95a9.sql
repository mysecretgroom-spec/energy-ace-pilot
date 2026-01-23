-- Add new expense categories to the frais_categorie enum
ALTER TYPE public.frais_categorie ADD VALUE IF NOT EXISTS 'train';
ALTER TYPE public.frais_categorie ADD VALUE IF NOT EXISTS 'location_vehicule';