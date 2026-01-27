-- Add RGE card fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS numero_agrement TEXT,
ADD COLUMN IF NOT EXISTS telephone_pro TEXT;