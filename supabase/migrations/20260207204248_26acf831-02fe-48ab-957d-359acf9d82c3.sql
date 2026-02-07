
-- Fix data_ite_finitions: drop the overly permissive policy and keep the proper one
DROP POLICY IF EXISTS "Authenticated users can view data_ite_finitions" ON public.data_ite_finitions;

-- Fix ai_workflows: restrict to authenticated users only
DROP POLICY IF EXISTS "Users can read active ai_workflows" ON public.ai_workflows;
CREATE POLICY "Users can read active ai_workflows"
  ON public.ai_workflows
  FOR SELECT
  TO authenticated
  USING (actif = true);
