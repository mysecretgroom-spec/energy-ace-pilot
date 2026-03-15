
-- Add 'installation' to rdv_type enum so the trigger works
ALTER TYPE rdv_type ADD VALUE IF NOT EXISTS 'installation';
