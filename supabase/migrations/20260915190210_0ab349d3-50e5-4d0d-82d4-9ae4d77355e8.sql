UPDATE public.ventes v
SET gamme = 'ISH',
    gamme_id = 'c05904d2-a455-4772-afc3-0340f011bb32'
WHERE v.gamme IS NULL
  AND v.regie_id = '78e53a3c-45b8-4ebd-9f63-5253c3ba43ea'
  AND (v.product_type IS NULL OR v.product_type = 'PV');

UPDATE public.ventes v
SET gamme_id = g.id
FROM public.regies_gammes g
WHERE v.gamme_id IS NULL
  AND v.gamme IS NOT NULL
  AND g.regie_id = v.regie_id
  AND lower(g.nom) = lower(v.gamme);