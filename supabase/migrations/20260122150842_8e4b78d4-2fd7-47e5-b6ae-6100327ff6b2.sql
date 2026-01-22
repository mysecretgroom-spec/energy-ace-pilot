-- Ajouter un enum pour le type de vente
CREATE TYPE public.vente_type AS ENUM ('standard', 'external_installation');

-- Ajouter la colonne type_vente à la table ventes
ALTER TABLE public.ventes 
ADD COLUMN type_vente public.vente_type NOT NULL DEFAULT 'standard';

-- Ajouter un commentaire pour documenter
COMMENT ON COLUMN public.ventes.type_vente IS 'Type de vente: standard = vente classique dans le pipeline, external_installation = installation pour un autre commercial (hors pipeline)';