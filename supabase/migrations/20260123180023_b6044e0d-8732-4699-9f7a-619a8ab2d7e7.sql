-- Add user_id column to data_psh table
ALTER TABLE public.data_psh 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view global or own PSH data" ON public.data_psh;
DROP POLICY IF EXISTS "Users can insert own PSH data" ON public.data_psh;
DROP POLICY IF EXISTS "Users can update own PSH data" ON public.data_psh;
DROP POLICY IF EXISTS "Users can delete own PSH data" ON public.data_psh;
DROP POLICY IF EXISTS "Authenticated users can view PSH data" ON public.data_psh;
DROP POLICY IF EXISTS "Admins can manage PSH data" ON public.data_psh;

-- Enable RLS
ALTER TABLE public.data_psh ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for user overrides
CREATE POLICY "Users can view global or own PSH data"
ON public.data_psh FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own PSH data"
ON public.data_psh FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own PSH data"
ON public.data_psh FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own PSH data"
ON public.data_psh FOR DELETE
TO authenticated
USING (user_id = auth.uid());