-- Update SECURITY DEFINER functions to include ownership validation
-- This prevents bypassing RLS policies

-- 1. Update propagate_regie_to_client to validate ownership
CREATE OR REPLACE FUNCTION public.propagate_regie_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate that the RDV belongs to the current user (or trigger context has valid ownership)
  -- The trigger fires on RDV insert/update, so we validate the RDV's user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  -- Validate the client belongs to the same user
  IF NOT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = NEW.client_id 
    AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Client does not belong to user';
  END IF;
  
  -- Only update if the RDV has a regie_id and it's different from what the client has
  IF NEW.regie_id IS NOT NULL THEN
    UPDATE public.clients 
    SET regie_id = NEW.regie_id, updated_at = now()
    WHERE id = NEW.client_id 
      AND user_id = NEW.user_id  -- Additional ownership check
      AND (regie_id IS NULL OR regie_id != NEW.regie_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Update auto_set_vente_regie to validate ownership
CREATE OR REPLACE FUNCTION public.auto_set_vente_regie()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  client_regie_id UUID;
  client_user_id UUID;
BEGIN
  -- Validate that the vente has a user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  -- Validate the client exists and belongs to the same user
  SELECT regie_id, user_id INTO client_regie_id, client_user_id
  FROM public.clients
  WHERE id = NEW.client_id;
  
  IF client_user_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;
  
  IF client_user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Unauthorized: Client does not belong to user';
  END IF;
  
  -- If vente doesn't have a regie_id, get it from the client
  IF NEW.regie_id IS NULL AND client_regie_id IS NOT NULL THEN
    NEW.regie_id := client_regie_id;
  END IF;
  
  RETURN NEW;
END;
$function$;