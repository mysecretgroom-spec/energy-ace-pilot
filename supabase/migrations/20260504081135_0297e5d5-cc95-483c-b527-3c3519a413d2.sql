CREATE OR REPLACE FUNCTION public.get_monthly_stats(p_user_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rdv_total INT := 0;
  v_rdv_confirme INT := 0;
  v_ventes_signees INT := 0;
  v_ventes_en_cours INT := 0;
  v_ca_ttc NUMERIC := 0;
  v_ca_ht NUMERIC := 0;
  v_taux_conversion NUMERIC := 0;
  v_commissions_total NUMERIC := 0;
  v_vente RECORD;
  v_commission JSONB;
BEGIN
  -- Comptage RDV (tous statuts sauf reporte/annule pour le confirme)
  -- Exclut les RDV d'installation (pas comptabilisés dans les stats)
  SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('reporte', 'annule')),
    COUNT(*)
  INTO v_rdv_confirme, v_rdv_total
  FROM rdv
  WHERE user_id = p_user_id
    AND date_heure::date >= p_start_date
    AND date_heure::date <= p_end_date
    AND COALESCE(type_rdv::text, 'standard') <> 'installation';
  
  SELECT 
    COUNT(*),
    COALESCE(SUM(montant_ttc), 0),
    COALESCE(SUM(montant_ht), 0)
  INTO v_ventes_signees, v_ca_ttc, v_ca_ht
  FROM ventes
  WHERE user_id = p_user_id
    AND date_signature >= p_start_date
    AND date_signature <= p_end_date
    AND status != 'annule'
    AND type_vente != 'external_installation';
  
  SELECT COUNT(*) INTO v_ventes_en_cours
  FROM ventes
  WHERE user_id = p_user_id
    AND status IN ('signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose');
  
  IF v_rdv_confirme > 0 THEN
    v_taux_conversion := ROUND((v_ventes_signees::NUMERIC / v_rdv_confirme * 100)::NUMERIC, 1);
  END IF;
  
  FOR v_vente IN 
    SELECT id FROM ventes 
    WHERE user_id = p_user_id 
      AND date_signature >= p_start_date 
      AND date_signature <= p_end_date
      AND status != 'annule'
  LOOP
    v_commission := calculate_vente_commission(v_vente.id);
    v_commissions_total := v_commissions_total + COALESCE((v_commission->>'commission_nette')::NUMERIC, 0);
  END LOOP;
  
  RETURN jsonb_build_object(
    'periode', jsonb_build_object('debut', p_start_date, 'fin', p_end_date),
    'rdv_total', v_rdv_total,
    'rdv_confirme', v_rdv_confirme,
    'ventes_signees', v_ventes_signees,
    'ventes_en_cours', v_ventes_en_cours,
    'ca_ttc', ROUND(v_ca_ttc, 2),
    'ca_ht', ROUND(v_ca_ht, 2),
    'taux_conversion', v_taux_conversion,
    'commissions_total', ROUND(v_commissions_total, 2)
  );
END;
$function$;