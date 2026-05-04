CREATE OR REPLACE FUNCTION public.auto_create_installation_rdv()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_rdv_datetime TIMESTAMPTZ;
  v_existing_rdv_id UUID;
  v_heure TIME;
  v_date DATE;
  v_project_type TEXT;
BEGIN
  v_date := NEW.date_installation_prevue;
  v_heure := COALESCE(NEW.heure_installation_prevue, '08:00:00'::time);

  IF TG_OP = 'UPDATE' THEN
    IF NEW.date_installation_prevue IS NOT DISTINCT FROM OLD.date_installation_prevue
       AND NEW.heure_installation_prevue IS NOT DISTINCT FROM OLD.heure_installation_prevue THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_date IS NULL THEN
    UPDATE public.rdv 
    SET status = 'annule', updated_at = now()
    WHERE client_id = NEW.client_id 
      AND user_id = NEW.user_id
      AND type_rdv = 'installation'
      AND status NOT IN ('annule', 'signe', 'negatif')
      AND metadata->>'vente_id' = NEW.id::text;
    RETURN NEW;
  END IF;

  -- Map product_type code to project_type enum
  v_project_type := CASE UPPER(COALESCE(NEW.product_type::text, ''))
    WHEN 'PV' THEN 'photovoltaique'
    WHEN 'PHOTOVOLTAIQUE' THEN 'photovoltaique'
    WHEN 'PAC' THEN 'pompe_chaleur'
    WHEN 'POMPE_CHALEUR' THEN 'pompe_chaleur'
    WHEN 'ITE' THEN 'isolation'
    WHEN 'ISOLATION' THEN 'isolation'
    WHEN 'BTD' THEN 'ballon_thermo'
    WHEN 'BALLON_THERMO' THEN 'ballon_thermo'
    ELSE 'photovoltaique'
  END;

  -- Build datetime: Paris is currently UTC+2 (CEST) in May
  -- Use AT TIME ZONE for correct DST handling
  v_rdv_datetime := (v_date::text || ' ' || v_heure::text)::timestamp AT TIME ZONE 'Europe/Paris';

  SELECT id, adresse, code_postal, ville INTO v_client
  FROM public.clients WHERE id = NEW.client_id;

  SELECT id INTO v_existing_rdv_id
  FROM public.rdv
  WHERE client_id = NEW.client_id
    AND user_id = NEW.user_id
    AND type_rdv = 'installation'
    AND status NOT IN ('annule')
    AND metadata->>'vente_id' = NEW.id::text
  LIMIT 1;

  IF v_existing_rdv_id IS NOT NULL THEN
    UPDATE public.rdv 
    SET date_heure = v_rdv_datetime,
        adresse = TRIM(COALESCE(v_client.adresse, '') || ' ' || COALESCE(v_client.code_postal, '') || ' ' || COALESCE(v_client.ville, '')),
        regie_id = COALESCE(NEW.regie_id, (SELECT regie_id FROM public.clients WHERE id = NEW.client_id)),
        updated_at = now()
    WHERE id = v_existing_rdv_id;
  ELSE
    INSERT INTO public.rdv (
      user_id, client_id, date_heure, duree_minutes,
      type_projet, status, type_rdv, regie_id,
      adresse, source, metadata
    ) VALUES (
      NEW.user_id,
      NEW.client_id,
      v_rdv_datetime,
      60,
      v_project_type::project_type,
      'nouveau',
      'installation',
      COALESCE(NEW.regie_id, (SELECT regie_id FROM public.clients WHERE id = NEW.client_id)),
      TRIM(COALESCE(v_client.adresse, '') || ' ' || COALESCE(v_client.code_postal, '') || ' ' || COALESCE(v_client.ville, '')),
      'auto_vente',
      jsonb_build_object('vente_id', NEW.id::text, 'auto_created', true)
    );
  END IF;

  RETURN NEW;
END;
$function$;