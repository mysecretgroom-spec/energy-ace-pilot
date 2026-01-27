-- Add stage name fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nom_scene TEXT,
ADD COLUMN IF NOT EXISTS prenom_scene TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.nom_scene IS 'Stage name used only in studies and RGE card';
COMMENT ON COLUMN public.profiles.prenom_scene IS 'Stage first name used only in studies and RGE card';