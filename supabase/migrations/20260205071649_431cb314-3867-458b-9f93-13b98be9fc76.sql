-- Add produit_principal column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN produit_principal TEXT DEFAULT 'photovoltaique';

-- Add check constraint for valid values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_produit_principal_check 
CHECK (produit_principal IN ('photovoltaique', 'pompe_a_chaleur', 'isolation'));