-- Table pour stocker les factures de commissions
CREATE TABLE public.factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  numero_facture TEXT NOT NULL,
  date_emission TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  montant_total_ht NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'emise' CHECK (statut IN ('emise', 'payee')),
  date_paiement TIMESTAMP WITH TIME ZONE,
  vente_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own factures"
  ON public.factures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own factures"
  ON public.factures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own factures"
  ON public.factures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own factures"
  ON public.factures FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_factures_user_id ON public.factures(user_id);
CREATE INDEX idx_factures_statut ON public.factures(statut);

-- Trigger for updated_at
CREATE TRIGGER update_factures_updated_at
  BEFORE UPDATE ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();