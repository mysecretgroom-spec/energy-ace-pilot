-- Add date_pose column to ventes table for tracking installation date
ALTER TABLE public.ventes 
ADD COLUMN IF NOT EXISTS date_pose DATE;