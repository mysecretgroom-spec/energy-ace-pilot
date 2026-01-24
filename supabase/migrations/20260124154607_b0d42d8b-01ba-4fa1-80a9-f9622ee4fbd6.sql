-- Make regie_id nullable to allow global defaults
ALTER TABLE public.regies_surcouts 
DROP CONSTRAINT regies_surcouts_regie_id_fkey;

ALTER TABLE public.regies_surcouts 
ALTER COLUMN regie_id DROP NOT NULL;

ALTER TABLE public.regies_surcouts 
ADD CONSTRAINT regies_surcouts_regie_id_fkey 
FOREIGN KEY (regie_id) REFERENCES public.regies(id) ON DELETE CASCADE;

-- Drop the unique constraint and recreate it to handle NULL regie_id
ALTER TABLE public.regies_surcouts DROP CONSTRAINT regies_surcouts_regie_id_categorie_code_key;

-- Create unique index that handles NULL regie_id properly
CREATE UNIQUE INDEX regies_surcouts_unique_global ON public.regies_surcouts (categorie, code) WHERE regie_id IS NULL;
CREATE UNIQUE INDEX regies_surcouts_unique_regie ON public.regies_surcouts (regie_id, categorie, code) WHERE regie_id IS NOT NULL;

-- Insert default surcharges (global, no regie_id)
-- Support d'installation
INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'support', 'pergola_carport', 'Pergola Carport', 3500, true
FROM auth.users LIMIT 1;

INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'support', 'bac_gse_sol', 'Bac GSE - Sol (par panneau)', 150, true
FROM auth.users LIMIT 1;

INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'support', 'surimposition', 'Surimposition', 0, true
FROM auth.users LIMIT 1;

-- Type de compteur
INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'compteur', 'monophase', 'Monophasé', 0, true
FROM auth.users LIMIT 1;

INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'compteur', 'triphase', 'Triphasé', 350, true
FROM auth.users LIMIT 1;

-- Distance / Emplacement boîtier
INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'emplacement_boitier', 'a_cote', 'A côté', 0, true
FROM auth.users LIMIT 1;

INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'emplacement_boitier', 'inf_10m', 'Distance < 10m', 0, true
FROM auth.users LIMIT 1;

INSERT INTO public.regies_surcouts (user_id, regie_id, categorie, code, nom, prix, actif)
SELECT id, NULL, 'emplacement_boitier', '10_20m', 'Distance 10 à 20m', 450, true
FROM auth.users LIMIT 1;

-- Update RLS policy to allow reading global defaults
DROP POLICY IF EXISTS "Users can view their own regies_surcouts" ON public.regies_surcouts;
CREATE POLICY "Users can view regies_surcouts" 
ON public.regies_surcouts 
FOR SELECT 
USING (auth.uid() = user_id OR regie_id IS NULL);