-- Update profil_revenus values to use MPR color codes
UPDATE public.data_aides_pac SET profil_revenus = 'bleu' WHERE profil_revenus = 'tres_modeste';
UPDATE public.data_aides_pac SET profil_revenus = 'jaune' WHERE profil_revenus = 'modeste';
UPDATE public.data_aides_pac SET profil_revenus = 'violet' WHERE profil_revenus = 'intermediaire';

-- Also update data_aides_ite if it uses the same naming
UPDATE public.data_aides_ite SET profil_revenus = 'bleu' WHERE profil_revenus = 'tres_modeste';
UPDATE public.data_aides_ite SET profil_revenus = 'jaune' WHERE profil_revenus = 'modeste';
UPDATE public.data_aides_ite SET profil_revenus = 'violet' WHERE profil_revenus = 'intermediaire';