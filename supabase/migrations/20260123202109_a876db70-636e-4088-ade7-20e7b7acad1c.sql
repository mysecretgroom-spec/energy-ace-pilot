-- Add rental period fields to frais table for location_vehicule category
ALTER TABLE public.frais 
ADD COLUMN date_debut date,
ADD COLUMN date_fin date;

-- Add comment for documentation
COMMENT ON COLUMN public.frais.date_debut IS 'Start date for rental expenses (location_vehicule)';
COMMENT ON COLUMN public.frais.date_fin IS 'End date for rental expenses (location_vehicule)';