-- Fix Jan 17: Move Nantes RDV to Toulouse area (near first RDV)
UPDATE public.rdv SET 
  adresse = '42 Rue Alsace-Lorraine',
  latitude = 43.6047,
  longitude = 1.4442
WHERE id = '3c5aaf14-1307-4aeb-8b73-1b909b03410c';

-- Fix Jan 27: Move Strasbourg RDV to Toulouse area (near first RDV)
UPDATE public.rdv SET 
  adresse = '18 Place du Capitole',
  latitude = 43.6045,
  longitude = 1.4440
WHERE id = '73d2bbb9-f83e-461c-8b0a-549c271d5683';

-- Fix Feb 13: Move Montpellier RDV to Paris area (near first RDV)
UPDATE public.rdv SET 
  adresse = '85 Boulevard Saint-Germain',
  latitude = 48.8534,
  longitude = 2.3488
WHERE id = 'b8456b6d-4d79-48e0-bb96-3a36e32e24cf';

-- Fix Mar 7: Move Marseille RDV to Strasbourg area (near first RDV)
UPDATE public.rdv SET 
  adresse = '14 Place Kléber',
  latitude = 48.5839,
  longitude = 7.7455
WHERE id = 'fd7c0e66-fc9c-42e8-8603-5c3965223f81';