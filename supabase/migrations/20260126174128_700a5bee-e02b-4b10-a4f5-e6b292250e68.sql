-- Ajout des colonnes pour séparer les coûts énergétiques PAC
-- pac_facture_chauffage_euros : coût annuel gaz/fioul/propane (ce que la PAC remplace)
-- pac_facture_elec_euros : coût annuel électricité actuel (augmentera avec la PAC)

ALTER TABLE public.etudes
ADD COLUMN IF NOT EXISTS pac_facture_chauffage_euros NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pac_facture_elec_euros NUMERIC DEFAULT NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN public.etudes.pac_facture_chauffage_euros IS 'Facture annuelle chauffage gaz/fioul/propane en euros (énergie remplacée par PAC)';
COMMENT ON COLUMN public.etudes.pac_facture_elec_euros IS 'Facture annuelle électricité actuelle en euros (avant installation PAC)';