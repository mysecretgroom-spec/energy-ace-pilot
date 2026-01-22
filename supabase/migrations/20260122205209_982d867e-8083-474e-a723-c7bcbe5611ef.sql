-- Add new document type values for complete client file
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo_tableau';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo_compteur';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'photo_toiture';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cni_monsieur_recto';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cni_madame_recto';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cni_monsieur_verso';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cni_madame_verso';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'rib';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'avis_impots';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'taxe_fonciere';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'acte_notarie';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'fiche_paie_monsieur';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'fiche_paie_madame';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'attestation_retraite';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'attestation_invalidite';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'bilans';