-- Add commission configuration table for global settings
CREATE TABLE public.config_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode_calcul text NOT NULL DEFAULT 'pourcentage' CHECK (mode_calcul IN ('pourcentage', 'bouquet')),
  part_survente_pct numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.config_commissions ENABLE ROW LEVEL SECURITY;

-- Policies for config_commissions
CREATE POLICY "Everyone can view config" ON public.config_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can modify config" ON public.config_commissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add bouquet-based commission fields to data_prix_bouquets
ALTER TABLE public.data_prix_bouquets 
ADD COLUMN IF NOT EXISTS commission_fixe numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_pct numeric DEFAULT 0;

-- Insert default config
INSERT INTO public.config_commissions (mode_calcul, part_survente_pct) VALUES ('pourcentage', 50);

-- Update trigger for config
CREATE TRIGGER update_config_commissions_updated_at
BEFORE UPDATE ON public.config_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();