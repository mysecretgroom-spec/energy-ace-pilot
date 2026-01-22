-- Ajouter le champ pour la date du R2
ALTER TABLE public.etudes 
ADD COLUMN IF NOT EXISTS r2_date_heure timestamp with time zone DEFAULT NULL;

-- Ajouter aussi dans l'historique
ALTER TABLE public.etudes_classification_history
ADD COLUMN IF NOT EXISTS r2_date_heure timestamp with time zone DEFAULT NULL;