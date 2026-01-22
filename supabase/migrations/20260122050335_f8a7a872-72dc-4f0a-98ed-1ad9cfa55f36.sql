-- Renommer commission_hejja en prix_hejja pour clarifier son usage
-- C'est le prix de vente TTC en mode Hejja (pas une commission)
ALTER TABLE data_prix_bouquets 
RENAME COLUMN commission_hejja TO prix_hejja;

-- Ajouter un commentaire pour documenter les colonnes
COMMENT ON COLUMN data_prix_bouquets.prix_recommande IS 'Prix de vente TTC normal (mode standard)';
COMMENT ON COLUMN data_prix_bouquets.prix_hejja IS 'Prix de vente TTC en mode HEJJA';
COMMENT ON COLUMN data_prix_bouquets.commission_fixe IS 'Commission fixe sur le prix normal (COM 2)';