-- Add decommission field to ventes table
ALTER TABLE public.ventes 
ADD COLUMN decom_montant numeric DEFAULT 0,
ADD COLUMN decom_raison text;