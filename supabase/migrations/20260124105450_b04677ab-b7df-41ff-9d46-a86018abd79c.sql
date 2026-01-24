-- Add columns to profiles for biometric login
-- Store user display info for biometric account selection
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS biometric_login_enabled BOOLEAN DEFAULT false;