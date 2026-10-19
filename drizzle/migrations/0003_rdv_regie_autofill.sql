CREATE OR REPLACE FUNCTION public.fill_rdv_regie_from_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.regie_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT regie_id INTO NEW.regie_id FROM public.clients
      WHERE id = NEW.client_id AND user_id = NEW.user_id;
    IF NEW.regie_id IS NULL THEN
      SELECT regie_id INTO NEW.regie_id FROM public.ventes
        WHERE client_id = NEW.client_id AND user_id = NEW.user_id AND regie_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fill_rdv_regie ON public.rdv;
CREATE TRIGGER fill_rdv_regie BEFORE INSERT OR UPDATE OF regie_id, client_id ON public.rdv
FOR EACH ROW EXECUTE FUNCTION public.fill_rdv_regie_from_client();

CREATE OR REPLACE FUNCTION public.fill_missing_rdv_regie_on_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.regie_id IS NOT NULL THEN
    UPDATE public.rdv SET regie_id = NEW.regie_id
      WHERE client_id = NEW.id AND user_id = NEW.user_id AND regie_id IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fill_rdv_regie_on_client ON public.clients;
CREATE TRIGGER fill_rdv_regie_on_client AFTER INSERT OR UPDATE OF regie_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.fill_missing_rdv_regie_on_client();