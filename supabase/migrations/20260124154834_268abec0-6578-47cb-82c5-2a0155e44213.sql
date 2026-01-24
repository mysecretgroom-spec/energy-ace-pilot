-- Update the default surcharges to remove amounts from names
UPDATE public.regies_surcouts 
SET nom = 'Pergola Carport' 
WHERE code = 'PERGOLA_CARPORT' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Bac GSE - Sol (par panneau)' 
WHERE code = 'BAC_GSE_SOL' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Surimposition' 
WHERE code = 'SURIMPOSITION' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Monophasé' 
WHERE code = 'MONOPHASE' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Triphasé' 
WHERE code = 'TRIPHASE' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'À côté' 
WHERE code = 'A_COTE' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Distance < 10m' 
WHERE code = 'DISTANCE_INF_10M' AND regie_id IS NULL;

UPDATE public.regies_surcouts 
SET nom = 'Distance 10 à 20m' 
WHERE code = 'DISTANCE_10_20M' AND regie_id IS NULL;