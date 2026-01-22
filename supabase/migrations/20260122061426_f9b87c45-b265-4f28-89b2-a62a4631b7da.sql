-- Add new statuses to vente_status enum
ALTER TYPE vente_status ADD VALUE IF NOT EXISTS 'cq_a_faire';
ALTER TYPE vente_status ADD VALUE IF NOT EXISTS 'cq_fait';
ALTER TYPE vente_status ADD VALUE IF NOT EXISTS 'attente_financement';
ALTER TYPE vente_status ADD VALUE IF NOT EXISTS 'envoi_pose';
ALTER TYPE vente_status ADD VALUE IF NOT EXISTS 'attente_paiement';