-- Trigger: when an installation RDV is created or promoted, sync the matching vente
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
BEGIN
  -- Only when this is an installation RDV not cancelled
  IF NEW.type_rdv IS DISTINCT FROM 'installation' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'annule' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: only act if relevant fields changed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.type_rdv = 'installation'
       AND OLD.date_heure = NEW.date_heure
       AND OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;
  END IF;

  v_date := (NEW.date_heure AT TIME ZONE 'Europe/Paris')::date;
  v_time := (NEW.date_heure AT TIME ZONE 'Europe/Paris')::time;

  -- Find latest non-finalised vente for this client/user
  SELECT id INTO v_vente_id
  FROM public.ventes
  WHERE user_id = NEW.user_id
    AND client_id = NEW.client_id
    AND status NOT IN ('installe','paye','annule','retracte','refus_financement','inFinancable')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_vente_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.ventes
  SET status = 'en_installation',
      date_installation_prevue = COALESCE(date_installation_prevue, v_date),
      heure_installation_prevue = COALESCE(heure_installation_prevue, v_time)
  WHERE id = v_vente_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vente_on_installation_rdv ON public.rdv;
CREATE TRIGGER trg_sync_vente_on_installation_rdv
AFTER INSERT OR UPDATE OF type_rdv, date_heure, status ON public.rdv
FOR EACH ROW
EXECUTE FUNCTION public.sync_vente_on_installation_rdv();