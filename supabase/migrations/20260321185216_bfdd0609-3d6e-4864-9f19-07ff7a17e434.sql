-- Fix Jan 26: Move Bordeaux RDV to Marseille area (near first RDV)
UPDATE public.rdv SET 
  adresse = '25 Cours Julien, 13006 Marseille',
  latitude = 43.2925,
  longitude = 5.3842
WHERE id = '84bf5e55-611b-4caf-8c94-b8bd6f3e5e08';

-- Fix Feb 12: Move Nantes RDV to Paris area (near first RDV)
UPDATE public.rdv SET 
  adresse = '42 Rue Mouffetard, 75005 Paris',
  latitude = 48.8432,
  longitude = 2.3498
WHERE id = 'dd899705-8771-46e9-8fa6-7ee0fd228183';