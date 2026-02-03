-- Create trigger function to auto-queue geocoding jobs for RDVs
CREATE OR REPLACE FUNCTION public.trigger_geocode_rdv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only queue a geocode job if:
  -- 1. The RDV has an address
  -- 2. It doesn't have coordinates yet
  -- 3. Either it's a new insert OR the address changed
  IF NEW.adresse IS NOT NULL 
     AND NEW.adresse != ''
     AND (NEW.latitude IS NULL OR NEW.longitude IS NULL)
     AND (OLD IS NULL OR OLD.adresse IS DISTINCT FROM NEW.adresse) THEN
    
    INSERT INTO public.background_jobs (
      user_id,
      job_type,
      payload,
      status,
      priority
    ) VALUES (
      NEW.user_id,
      'geocode_rdv',
      jsonb_build_object(
        'rdvId', NEW.id,
        'address', NEW.adresse
      ),
      'pending',
      5  -- Medium priority
    );
    
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on the rdv table
DROP TRIGGER IF EXISTS auto_geocode_rdv_trigger ON public.rdv;

CREATE TRIGGER auto_geocode_rdv_trigger
AFTER INSERT OR UPDATE OF adresse
ON public.rdv
FOR EACH ROW
EXECUTE FUNCTION public.trigger_geocode_rdv();