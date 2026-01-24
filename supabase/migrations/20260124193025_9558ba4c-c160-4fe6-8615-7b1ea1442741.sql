-- Drop the existing restrictive policy on clients table
DROP POLICY IF EXISTS "Users can CRUD own clients" ON public.clients;

-- Create proper PERMISSIVE policies for the clients table
-- These ensure users can only access their own clients

CREATE POLICY "Users can view own clients" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" 
ON public.clients 
FOR DELETE 
USING (auth.uid() = user_id);