-- Table pour les options de financement
CREATE TABLE public.data_financements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  taux_effectif NUMERIC(5, 2) NOT NULL DEFAULT 0,
  taeg NUMERIC(5, 2) NOT NULL DEFAULT 0,
  duree_mois INTEGER NOT NULL DEFAULT 180,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_financements ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read
CREATE POLICY "Authenticated users can read financements"
ON public.data_financements
FOR SELECT
TO authenticated
USING (true);

-- Policy for authenticated users to insert
CREATE POLICY "Authenticated users can insert financements"
ON public.data_financements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy for authenticated users to update
CREATE POLICY "Authenticated users can update financements"
ON public.data_financements
FOR UPDATE
TO authenticated
USING (true);

-- Policy for authenticated users to delete
CREATE POLICY "Authenticated users can delete financements"
ON public.data_financements
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_data_financements_updated_at
BEFORE UPDATE ON public.data_financements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default financing options
INSERT INTO public.data_financements (nom, taux_effectif, taeg, duree_mois, actif) VALUES
  ('Comptant', 0, 0, 1, true),
  ('Financement 120 mois', 5.9, 6.2, 120, true),
  ('Financement 180 mois', 6.5, 6.9, 180, true),
  ('Financement 240 mois', 7.2, 7.6, 240, true);