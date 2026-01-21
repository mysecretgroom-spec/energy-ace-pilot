-- Add geocoding fields to clients for distance calculations
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add geocoding fields to rdv for distance calculations
ALTER TABLE public.rdv 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add travel info fields to rdv
ALTER TABLE public.rdv 
ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER;

-- Add OCR data field to frais table if not exists
ALTER TABLE public.frais 
ADD COLUMN IF NOT EXISTS ocr_data JSONB;

-- Add justificatif_url to frais if not exists
ALTER TABLE public.frais 
ADD COLUMN IF NOT EXISTS justificatif_url TEXT;