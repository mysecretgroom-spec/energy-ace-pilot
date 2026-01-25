
-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 29,
  price_yearly NUMERIC,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can read active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

-- Only admins can manage plans (via RPC)
CREATE OR REPLACE FUNCTION public.get_all_subscription_plans()
RETURNS SETOF public.subscription_plans
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.subscription_plans ORDER BY sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_subscription_plan(
  p_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT '',
  p_description TEXT DEFAULT '',
  p_price_monthly NUMERIC DEFAULT 29,
  p_price_yearly NUMERIC DEFAULT NULL,
  p_stripe_price_id_monthly TEXT DEFAULT NULL,
  p_stripe_price_id_yearly TEXT DEFAULT NULL,
  p_features JSONB DEFAULT '[]'::jsonb,
  p_is_popular BOOLEAN DEFAULT false,
  p_is_active BOOLEAN DEFAULT true,
  p_sort_order INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features, is_popular, is_active, sort_order)
    VALUES (p_name, p_description, p_price_monthly, p_price_yearly, p_stripe_price_id_monthly, p_stripe_price_id_yearly, p_features, p_is_popular, p_is_active, p_sort_order)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.subscription_plans
    SET name = p_name,
        description = p_description,
        price_monthly = p_price_monthly,
        price_yearly = p_price_yearly,
        stripe_price_id_monthly = p_stripe_price_id_monthly,
        stripe_price_id_yearly = p_stripe_price_id_yearly,
        features = p_features,
        is_popular = p_is_popular,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = now()
    WHERE id = p_id;
    v_id := p_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_subscription_plan(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_saas_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.subscription_plans WHERE id = p_id;
END;
$$;

-- Insert default plan
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features, is_popular, sort_order)
VALUES (
  'Premium',
  'Accès complet à toutes les fonctionnalités',
  29,
  290,
  '["Gestion complète du planning", "Suivi CRM et ventes", "Synchronisation Gmail", "Gestion des frais", "Notifications push", "Support prioritaire"]'::jsonb,
  true,
  1
);
