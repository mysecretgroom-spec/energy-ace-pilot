-- Create table for agency-specific surcharges (support, box location, meter type)
CREATE TABLE public.regies_surcouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regie_id UUID NOT NULL REFERENCES public.regies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  categorie TEXT NOT NULL CHECK (categorie IN ('support', 'emplacement_boitier', 'compteur')),
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  prix NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(regie_id, categorie, code)
);

-- Enable Row Level Security
ALTER TABLE public.regies_surcouts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own regies_surcouts" 
ON public.regies_surcouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own regies_surcouts" 
ON public.regies_surcouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own regies_surcouts" 
ON public.regies_surcouts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own regies_surcouts" 
ON public.regies_surcouts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_regies_surcouts_updated_at
BEFORE UPDATE ON public.regies_surcouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();