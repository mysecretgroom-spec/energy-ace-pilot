-- Supprimer l'ancienne contrainte de catégories
ALTER TABLE regies_surcouts DROP CONSTRAINT IF EXISTS regies_surcouts_categorie_check;

-- Ajouter une contrainte élargie incluant PAC et ITE
ALTER TABLE regies_surcouts ADD CONSTRAINT regies_surcouts_categorie_check 
CHECK (categorie = ANY (ARRAY[
  -- PV
  'support', 'emplacement_boitier', 'compteur',
  -- PAC
  'type_pac', 'installation', 'accessoires',
  -- ITE
  'finition', 'complexite', 'accessoires_ite'
]));

-- Permettre user_id NULL pour les surcoûts par défaut globaux
ALTER TABLE regies_surcouts ALTER COLUMN user_id DROP NOT NULL;