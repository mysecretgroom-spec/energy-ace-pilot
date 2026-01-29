
-- Clean up ALL duplicate/conflicting RLS policies and enforce strict authenticated-only access

-- 1. subscription_plans - Remove ALL old policies and create single strict one
DROP POLICY IF EXISTS "Anyone can read active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can view plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. bouquets - Remove ALL conflicting policies
DROP POLICY IF EXISTS "Authenticated users can read global or own bouquets" ON public.bouquets;
DROP POLICY IF EXISTS "Authenticated users can view bouquets" ON public.bouquets;
DROP POLICY IF EXISTS "Users can view bouquets" ON public.bouquets;

CREATE POLICY "Authenticated users can view bouquets"
ON public.bouquets
FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

-- 3. regies_surcouts - Remove ALL conflicting policies
DROP POLICY IF EXISTS "Authenticated users can view regies_surcouts" ON public.regies_surcouts;
DROP POLICY IF EXISTS "Users can view regies_surcouts" ON public.regies_surcouts;
DROP POLICY IF EXISTS "Users can view their regies surcouts" ON public.regies_surcouts;

CREATE POLICY "Authenticated users can view regies_surcouts"
ON public.regies_surcouts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  regie_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.regies r 
    WHERE r.id = regies_surcouts.regie_id 
    AND r.user_id = auth.uid()
  )
);
