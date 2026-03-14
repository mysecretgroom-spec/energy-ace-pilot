-- Function to auto-create/update installation RDV when date_installation_prevue changes
CREATE OR REPLACE FUNCTION public.auto_create_installation_rdv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_rdv_datetime TIMESTAMPTZ;
  v_existing_rdv_id UUID;
  v_heure TIME;
  v_date DATE;
BEGIN
  v_date := NEW.date_installation_prevue;
  v_heure := COALESCE(NEW.heure_installation_prevue, '08:00:00'::time);
  
  -- Skip if nothing actually changed (for UPDATE)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.date_installation_prevue IS NOT DISTINCT FROM OLD.date_installation_prevue
       AND NEW.heure_installation_prevue IS NOT DISTINCT FROM OLD.heure_installation_prevue THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Date removed: cancel existing installation RDV if any
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
  
  -- Build datetime in Paris timezone
  v_rdv_datetime := (v_date::text || 'T' || v_heure::text || '+01:00')::timestamptz;
  
  -- Get client info for address
  SELECT id, adresse, code_postal, ville INTO v_client
  FROM public.clients WHERE id = NEW.client_id;
  
  -- Check if an installation RDV already exists for this vente
  SELECT id INTO v_existing_rdv_id
  FROM public.rdv
  WHERE client_id = NEW.client_id
    AND user_id = NEW.user_id
    AND type_rdv = 'installation'
    AND status NOT IN ('annule')
    AND metadata->>'vente_id' = NEW.id::text
  LIMIT 1;
  
  IF v_existing_rdv_id IS NOT NULL THEN
    -- Update existing installation RDV
    UPDATE public.rdv 
    SET date_heure = v_rdv_datetime,
        adresse = TRIM(COALESCE(v_client.adresse, '') || ' ' || COALESCE(v_client.code_postal, '') || ' ' || COALESCE(v_client.ville, '')),
        regie_id = COALESCE(NEW.regie_id, (SELECT regie_id FROM public.clients WHERE id = NEW.client_id)),
        updated_at = now()
    WHERE id = v_existing_rdv_id;
  ELSE
    -- Create new installation RDV
    INSERT INTO public.rdv (
      user_id, client_id, date_heure, duree_minutes,
      type_projet, status, type_rdv, regie_id,
      adresse, source, metadata
    ) VALUES (
      NEW.user_id,
      NEW.client_id,
      v_rdv_datetime,
      60,
      COALESCE(NEW.product_type::text, 'photovoltaique')::project_type,
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
$$;

-- Trigger on ventes table
DROP TRIGGER IF EXISTS trg_auto_installation_rdv ON public.ventes;
CREATE TRIGGER trg_auto_installation_rdv
  AFTER INSERT OR UPDATE OF date_installation_prevue, heure_installation_prevue
  ON public.ventes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_installation_rdv();