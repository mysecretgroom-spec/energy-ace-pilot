-- Fix security: Restrict public access to sensitive business data

-- 1. subscription_plans - Restrict to authenticated users
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Authenticated users can view plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (true);

-- 2. bouquets - Restrict to authenticated users (owner access)
DROP POLICY IF EXISTS "Anyone can view active bouquets" ON public.bouquets;
DROP POLICY IF EXISTS "Users can view bouquets" ON public.bouquets;

CREATE POLICY "Users can view bouquets"
ON public.bouquets
FOR SELECT
TO authenticated
USING (user_id IS NULL OR user_id = auth.uid());

-- 3. regies_surcouts - Restrict to authenticated users (owner access)
ALTER TABLE public.regies_surcouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view surcouts" ON public.regies_surcouts;
DROP POLICY IF EXISTS "Users can view their regies surcouts" ON public.regies_surcouts;

CREATE POLICY "Users can view their regies surcouts"
ON public.regies_surcouts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regies r 
    WHERE r.id = regies_surcouts.regie_id 
    AND r.user_id = auth.uid()
  )
);