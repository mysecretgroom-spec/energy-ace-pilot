CREATE OR REPLACE FUNCTION public.sync_vente_on_installation_rdv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vente_id uuid;
  v_date date;
  v_time time;
  v_date_changed boolean := false;
  v_type_changed boolean := false;
  -- Statuts finalisés: jamais de mise à jour automatique
  c_finalised_statuses constant text[] := ARRAY[
    'installe','paye','annule','retracte','refus_financement','inFinancable'
  ];
BEGIN
  IF NEW.type_rdv IS DISTINCT FROM 'installation' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'annule' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_type_changed := OLD.type_rdv IS DISTINCT FROM NEW.type_rdv;
    v_date_changed := OLD.date_heure IS DISTINCT FROM NEW.date_heure;
    IF NOT v_type_changed AND NOT v_date_changed THEN
      RETURN NEW;
    END IF;
  ELSE
    v_type_changed := true;
  END IF;

  v_date := (NEW.date_heure AT TIME ZONE 'Europe/Paris')::date;
  v_time := (NEW.date_heure AT TIME ZONE 'Europe/Paris')::time;

  -- Recherche: exclut explicitement les ventes finalisées
  SELECT id INTO v_vente_id
  FROM public.ventes
  WHERE user_id = NEW.user_id
    AND client_id = NEW.client_id
    AND status::text <> ALL (c_finalised_statuses)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_vente_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_date_changed AND NOT v_type_changed THEN
    UPDATE public.ventes
    SET status = 'en_installation',
        date_installation_prevue = v_date,
        heure_installation_prevue = v_time
    WHERE id = v_vente_id
      -- Garde explicite: aucune mise à jour si la vente est finalisée
      AND status::text <> ALL (c_finalised_statuses);
  ELSE
    UPDATE public.ventes
    SET status = 'en_installation',
        date_installation_prevue = COALESCE(date_installation_prevue, v_date),
        heure_installation_prevue = COALESCE(heure_installation_prevue, v_time)
    WHERE id = v_vente_id
      AND status::text <> ALL (c_finalised_statuses);
  END IF;

  RETURN NEW;
END;
$$;