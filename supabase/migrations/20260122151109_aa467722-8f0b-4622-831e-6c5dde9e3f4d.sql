-- Ajouter un enum pour le type de RDV
CREATE TYPE public.rdv_type AS ENUM ('standard', 'external_installation');

-- Ajouter la colonne type_rdv à la table rdv
ALTER TABLE public.rdv 
ADD COLUMN type_rdv public.rdv_type NOT NULL DEFAULT 'standard';

-- Ajouter un commentaire pour documenter
COMMENT ON COLUMN public.rdv.type_rdv IS 'Type de RDV: standard = RDV commercial classique, external_installation = installation pour un autre commercial';