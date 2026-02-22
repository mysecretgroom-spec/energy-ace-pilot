-- Fix the geocode trigger to include city and postal code in the payload
CREATE OR REPLACE FUNCTION public.trigger_geocode_rdv()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_full_address TEXT;
  v_city TEXT;
  v_postal TEXT;
BEGIN
  IF NEW.adresse IS NOT NULL 
     AND NEW.adresse != ''
     AND (NEW.latitude IS NULL OR NEW.longitude IS NULL)
     AND (OLD IS NULL OR OLD.adresse IS DISTINCT FROM NEW.adresse) THEN
    
    -- Get city and postal code from client
    SELECT ville, code_postal INTO v_city, v_postal
    FROM public.clients WHERE id = NEW.client_id;
    
    -- Build full address with city and postal code for better geocoding
    v_full_address := NEW.adresse;
    IF v_postal IS NOT NULL AND v_postal != '' AND position(v_postal in NEW.adresse) = 0 THEN
      v_full_address := v_full_address || ' ' || v_postal;
    END IF;
    IF v_city IS NOT NULL AND v_city != '' AND position(upper(v_city) in upper(NEW.adresse)) = 0 THEN
      v_full_address := v_full_address || ' ' || v_city;
    END IF;
    
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
        'address', v_full_address,
        'city', COALESCE(v_city, ''),
        'postalCode', COALESCE(v_postal, '')
      ),
      'pending',
      5
    );
    
  END IF;
  RETURN NEW;
END;
$function$;