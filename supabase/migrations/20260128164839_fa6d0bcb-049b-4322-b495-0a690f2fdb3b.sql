-- Add working_days column if it doesn't exist
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS working_days INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6];