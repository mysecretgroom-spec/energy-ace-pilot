-- Ajouter les champs de classification à la table etudes
ALTER TABLE public.etudes 
ADD COLUMN IF NOT EXISTS classification character varying DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classification_comment text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classification_updated_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classification_updated_by uuid DEFAULT NULL;

-- Créer la table d'historique des classifications
CREATE TABLE public.etudes_classification_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etude_id uuid NOT NULL REFERENCES public.etudes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  classification character varying NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.etudes_classification_history ENABLE ROW LEVEL SECURITY;

-- Create policies for classification history
CREATE POLICY "Users can view classification history for their etudes"
ON public.etudes_classification_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.etudes 
    WHERE etudes.id = etudes_classification_history.etude_id 
    AND etudes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert classification history for their etudes"
ON public.etudes_classification_history
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.etudes 
    WHERE etudes.id = etudes_classification_history.etude_id 
    AND etudes.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_classification_history_etude ON public.etudes_classification_history(etude_id);
CREATE INDEX idx_classification_history_created ON public.etudes_classification_history(created_at DESC);