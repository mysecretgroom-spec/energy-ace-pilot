-- Create plaid_items table to store user bank connections
CREATE TABLE public.plaid_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own Plaid items
CREATE POLICY "Users can view their own plaid items"
ON public.plaid_items
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own Plaid items
CREATE POLICY "Users can insert their own plaid items"
ON public.plaid_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own Plaid items
CREATE POLICY "Users can update their own plaid items"
ON public.plaid_items
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own Plaid items
CREATE POLICY "Users can delete their own plaid items"
ON public.plaid_items
FOR DELETE
USING (auth.uid() = user_id);

-- Add unique constraint on user_id (one bank connection per user for simplicity)
ALTER TABLE public.plaid_items ADD CONSTRAINT plaid_items_user_id_unique UNIQUE (user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_plaid_items_updated_at
BEFORE UPDATE ON public.plaid_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();