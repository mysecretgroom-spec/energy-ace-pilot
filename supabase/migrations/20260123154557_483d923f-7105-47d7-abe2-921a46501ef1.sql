-- Create regies_financements table for per-regie financing options
CREATE TABLE public.regies_financements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  regie_id UUID NOT NULL REFERENCES public.regies(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  taux_effectif NUMERIC NOT NULL DEFAULT 0,
  taeg NUMERIC NOT NULL DEFAULT 0,
  duree_mois INTEGER NOT NULL DEFAULT 120,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regies_financements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own regies_financements" 
ON public.regies_financements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own regies_financements" 
ON public.regies_financements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own regies_financements" 
ON public.regies_financements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own regies_financements" 
ON public.regies_financements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_regies_financements_updated_at
BEFORE UPDATE ON public.regies_financements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();