-- Drop existing RESTRICTIVE policies on plaid_items
DROP POLICY IF EXISTS "Users can delete their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can insert their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can update their own plaid items" ON public.plaid_items;
DROP POLICY IF EXISTS "Users can view their own plaid items" ON public.plaid_items;

-- Create proper PERMISSIVE policies for plaid_items
-- These ensure only the owner can access their own Plaid tokens

CREATE POLICY "Users can view own plaid items" 
ON public.plaid_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plaid items" 
ON public.plaid_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plaid items" 
ON public.plaid_items 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plaid items" 
ON public.plaid_items 
FOR DELETE 
USING (auth.uid() = user_id);