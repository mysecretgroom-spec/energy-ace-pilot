-- Remove unique constraint on user_id to allow multiple bank accounts
ALTER TABLE public.plaid_items DROP CONSTRAINT IF EXISTS plaid_items_user_id_unique;

-- Add unique constraint on item_id instead (each Plaid item should be unique)
ALTER TABLE public.plaid_items ADD CONSTRAINT plaid_items_item_id_unique UNIQUE (item_id);

-- Add plaid_item_id to plaid_syncs for tracking syncs per account
ALTER TABLE public.plaid_syncs ADD COLUMN IF NOT EXISTS plaid_item_id UUID REFERENCES public.plaid_items(id) ON DELETE SET NULL;

-- Add sync_type to distinguish webhook vs manual syncs
ALTER TABLE public.plaid_syncs ADD COLUMN IF NOT EXISTS sync_type TEXT DEFAULT 'manual';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON public.plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item ON public.plaid_items(item_id);