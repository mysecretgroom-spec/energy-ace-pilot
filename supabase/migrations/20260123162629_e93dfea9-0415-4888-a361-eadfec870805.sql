-- Add regie_id to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS regie_id UUID REFERENCES public.regies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clients_regie_id ON public.clients(regie_id);

-- Function to propagate regie_id from RDV to client
CREATE OR REPLACE FUNCTION public.propagate_regie_to_client()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if the RDV has a regie_id and it's different from what the client has
  IF NEW.regie_id IS NOT NULL THEN
    UPDATE public.clients 
    SET regie_id = NEW.regie_id, updated_at = now()
    WHERE id = NEW.client_id 
      AND (regie_id IS NULL OR regie_id != NEW.regie_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on RDV insert/update to propagate regie to client
DROP TRIGGER IF EXISTS propagate_regie_on_rdv ON public.rdv;
CREATE TRIGGER propagate_regie_on_rdv
  AFTER INSERT OR UPDATE OF regie_id ON public.rdv
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_regie_to_client();

-- Function to auto-set regie_id on vente from client if not specified
CREATE OR REPLACE FUNCTION public.auto_set_vente_regie()
RETURNS TRIGGER AS $$
DECLARE
  client_regie_id UUID;
BEGIN
  -- If vente doesn't have a regie_id, get it from the client
  IF NEW.regie_id IS NULL THEN
    SELECT regie_id INTO client_regie_id
    FROM public.clients
    WHERE id = NEW.client_id;
    
    IF client_regie_id IS NOT NULL THEN
      NEW.regie_id := client_regie_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on vente insert to auto-set regie from client
DROP TRIGGER IF EXISTS auto_set_regie_on_vente ON public.ventes;
CREATE TRIGGER auto_set_regie_on_vente
  BEFORE INSERT ON public.ventes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_vente_regie();

-- Backfill: Update existing clients with regie_id from their most recent RDV
UPDATE public.clients c
SET regie_id = (
  SELECT r.regie_id 
  FROM public.rdv r 
  WHERE r.client_id = c.id AND r.regie_id IS NOT NULL 
  ORDER BY r.date_heure DESC 
  LIMIT 1
)
WHERE c.regie_id IS NULL;

-- Backfill: Update existing ventes without regie_id from their client
UPDATE public.ventes v
SET regie_id = c.regie_id
FROM public.clients c
WHERE v.client_id = c.id 
  AND v.regie_id IS NULL 
  AND c.regie_id IS NOT NULL;