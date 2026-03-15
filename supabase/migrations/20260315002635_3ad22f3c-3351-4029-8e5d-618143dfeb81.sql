
-- Function to get trial agent usage count (factures sent by trial users)
CREATE OR REPLACE FUNCTION public.get_trial_agent_facture_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_access text;
BEGIN
  -- Check if user is in trial
  SELECT app_access INTO v_access FROM saas.access_state WHERE user_id = p_user_id;
  IF v_access != 'trial' THEN
    RETURN 0; -- Not trial, no limit applies
  END IF;

  -- Count import_facture actions (frais_imported) for this user during trial
  SELECT COUNT(*) INTO v_count
  FROM public.whatsapp_agent_actions
  WHERE user_id = p_user_id
    AND action_type = 'create_frais'
    AND is_undone = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
