ALTER TABLE saas.access_state 
ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS beta_expires_at timestamptz DEFAULT NULL;