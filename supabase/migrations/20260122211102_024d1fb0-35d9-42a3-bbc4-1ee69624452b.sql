-- Add configurable delay for automatic status transition
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS vente_auto_transition_weeks integer NOT NULL DEFAULT 2;

-- Add date_installation_reelle tracking for ventes if not already used properly
-- The column already exists, we just need to ensure it's populated when status changes to 'installe'