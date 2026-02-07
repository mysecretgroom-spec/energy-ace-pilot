
-- Fix calculate_vente_commission to filter bouquets by product_type
CREATE OR REPLACE FUNCTION public.calculate_vente_commission(p_vente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vente RECORD;
  v_regie RECORD;
  v_etude RECORD;
  v_config RECORD;
  v_bouquet RECORD;
  v_tier RECORD;
  v_mode TEXT;
  v_commission_base NUMERIC := 0;
  v_bonus_survente NUMERIC := 0;
  v_decom NUMERIC := 0;
  v_commission_nette NUMERIC := 0;
  v_part_survente_pct NUMERIC := 50;
  v_taux_tva NUMERIC;
  v_montant_ttc NUMERIC;
  v_prix_reco NUMERIC;
  v_total_surcouts NUMERIC := 0;
  v_survente_ht NUMERIC;
  v_is_interpolated BOOLEAN := false;
  v_taux_applique NUMERIC;
  v_product_type TEXT;
BEGIN
  -- Récupérer la vente
  SELECT * INTO v_vente FROM ventes WHERE id = p_vente_id;
  IF v_vente IS NULL THEN
    RETURN jsonb_build_object('error', 'Vente non trouvée');
  END IF;
  
  v_decom := COALESCE(v_vente.decom_montant, 0);
  v_product_type := v_vente.product_type;
  
  -- CAS 1: Vente annulée
  IF v_vente.status = 'annule' THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id,
      'type', 'cancelled',
      'mode', 'none',
      'commission_base', 0,
      'bonus_survente', 0,
      'decom_montant', v_decom,
      'commission_nette', 0,
      'montant_ht', v_vente.montant_ht
    );
  END IF;
  
  -- CAS 2: Installation externe
  IF v_vente.type_vente = 'external_installation' THEN
    v_commission_nette := GREATEST(0, v_vente.montant_ht - v_decom);
    RETURN jsonb_build_object(
      'vente_id', p_vente_id,
      'type', 'external',
      'mode', 'externe',
      'commission_base', v_vente.montant_ht,
      'bonus_survente', 0,
      'decom_montant', v_decom,
      'commission_nette', v_commission_nette,
      'montant_ht', v_vente.montant_ht
    );
  END IF;
  
  -- Récupérer config régie
  IF v_vente.regie_id IS NOT NULL THEN
    SELECT mode_calcul_commission, part_survente_pct INTO v_regie
    FROM regies WHERE id = v_vente.regie_id;
    v_mode := COALESCE(v_regie.mode_calcul_commission, 'bouquet');
    v_part_survente_pct := COALESCE(v_regie.part_survente_pct, 50);
  ELSE
    SELECT mode_calcul, part_survente_pct INTO v_config FROM config_commissions LIMIT 1;
    v_mode := COALESCE(v_config.mode_calcul, 'bouquet');
    v_part_survente_pct := COALESCE(v_config.part_survente_pct, 50);
  END IF;
  
  -- MODE POURCENTAGE
  IF v_mode = 'pourcentage' THEN
    -- Filter by product_type if available
    SELECT * INTO v_tier FROM data_commissions 
    WHERE v_vente.montant_ht >= tranche_min AND v_vente.montant_ht <= tranche_max
      AND (v_product_type IS NULL OR product_type IS NULL OR product_type::text = v_product_type)
    ORDER BY tranche_min LIMIT 1;
    
    IF v_tier IS NULL THEN
      SELECT * INTO v_tier FROM data_commissions 
      WHERE (v_product_type IS NULL OR product_type IS NULL OR product_type::text = v_product_type)
      ORDER BY tranche_max DESC LIMIT 1;
    END IF;
    
    IF v_tier IS NOT NULL THEN
      v_taux_applique := v_tier.taux_commission;
      v_commission_base := v_vente.montant_ht * (v_tier.taux_commission / 100);
      v_bonus_survente := v_vente.montant_ht * (COALESCE(v_tier.bonus_survente, 0) / 100);
    ELSE
      v_taux_applique := 5;
      v_commission_base := v_vente.montant_ht * 0.05;
    END IF;
    
    v_commission_nette := GREATEST(0, v_commission_base + v_bonus_survente - v_decom);
    
    RETURN jsonb_build_object(
      'vente_id', p_vente_id,
      'type', 'standard',
      'mode', 'pourcentage',
      'commission_base', ROUND(v_commission_base, 2),
      'bonus_survente', ROUND(v_bonus_survente, 2),
      'decom_montant', v_decom,
      'commission_nette', ROUND(v_commission_nette, 2),
      'montant_ht', v_vente.montant_ht,
      'taux_applique', v_taux_applique
    );
  END IF;
  
  -- MODE BOUQUET (défaut)
  IF v_vente.puissance_kwc IS NULL OR v_vente.puissance_kwc <= 0 THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id,
      'type', 'standard',
      'mode', 'bouquet',
      'commission_base', 0,
      'bonus_survente', 0,
      'decom_montant', v_decom,
      'commission_nette', 0,
      'montant_ht', v_vente.montant_ht,
      'error', 'Puissance manquante'
    );
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Chercher bouquet SPÉCIFIQUE à la régie + product_type, sinon global
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- 1) Essayer le bouquet régie-spécifique + product_type (prioritaire)
  IF v_vente.regie_id IS NOT NULL THEN
    SELECT commission_fixe, prix_recommande INTO v_bouquet
    FROM bouquets 
    WHERE actif = true 
      AND puissance_kwc = v_vente.puissance_kwc
      AND v_vente.regie_id = ANY(regie_ids)
      AND (v_product_type IS NULL OR product_type::text = v_product_type)
    LIMIT 1;
  END IF;
  
  -- 2) Si pas de bouquet régie, fallback sur bouquet global + product_type
  IF v_bouquet IS NULL THEN
    SELECT commission_fixe, prix_recommande INTO v_bouquet
    FROM bouquets 
    WHERE actif = true 
      AND puissance_kwc = v_vente.puissance_kwc
      AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL)
      AND (v_product_type IS NULL OR product_type::text = v_product_type)
    LIMIT 1;
  END IF;
  
  -- 3) Si toujours pas trouvé, interpolation avec product_type filter
  IF v_bouquet IS NULL THEN
    WITH bounds AS (
      SELECT 
        COALESCE(
          (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1),
          (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1)
        ) as lower_comm,
        COALESCE(
          (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1),
          (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1)
        ) as lower_kwc,
        COALESCE(
          (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1),
          (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc DESC LIMIT 1)
        ) as lower_prix,
        COALESCE(
          (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1),
          (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1)
        ) as upper_comm,
        COALESCE(
          (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1),
          (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1)
        ) as upper_kwc,
        COALESCE(
          (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND v_vente.regie_id = ANY(regie_ids) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1),
          (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL) AND (v_product_type IS NULL OR product_type::text = v_product_type) ORDER BY puissance_kwc ASC LIMIT 1)
        ) as upper_prix
    )
    SELECT 
      CASE 
        WHEN lower_kwc IS NOT NULL AND upper_kwc IS NOT NULL THEN
          lower_comm + (upper_comm - lower_comm) * ((v_vente.puissance_kwc - lower_kwc) / (upper_kwc - lower_kwc))
        WHEN lower_kwc IS NOT NULL THEN lower_comm
        WHEN upper_kwc IS NOT NULL THEN upper_comm
        ELSE 0
      END as commission_fixe,
      CASE 
        WHEN lower_kwc IS NOT NULL AND upper_kwc IS NOT NULL THEN
          lower_prix + (upper_prix - lower_prix) * ((v_vente.puissance_kwc - lower_kwc) / (upper_kwc - lower_kwc))
        WHEN lower_kwc IS NOT NULL THEN lower_prix
        WHEN upper_kwc IS NOT NULL THEN upper_prix
        ELSE 0
      END as prix_recommande
    INTO v_bouquet FROM bounds;
    v_is_interpolated := true;
  END IF;
  
  v_commission_base := COALESCE(v_bouquet.commission_fixe, 0);
  v_prix_reco := COALESCE(v_bouquet.prix_recommande, 0);
  
  -- Calcul survente
  v_taux_tva := CASE WHEN v_vente.puissance_kwc <= 3 THEN 10 ELSE 20 END;
  v_montant_ttc := COALESCE(v_vente.montant_ttc, v_vente.montant_ht * (1 + v_taux_tva / 100));
  
  -- Récupérer surcouts depuis l'étude
  IF v_vente.etude_id IS NOT NULL THEN
    SELECT COALESCE(surcout_support, 0) + COALESCE(surcout_compteur, 0) + COALESCE(autre_surcout, 0)
    INTO v_total_surcouts FROM etudes WHERE id = v_vente.etude_id;
  END IF;
  
  IF v_prix_reco > 0 AND (v_montant_ttc - COALESCE(v_total_surcouts, 0)) > v_prix_reco THEN
    v_survente_ht := ((v_montant_ttc - COALESCE(v_total_surcouts, 0)) - v_prix_reco) / (1 + v_taux_tva / 100);
    v_bonus_survente := v_survente_ht * (v_part_survente_pct / 100);
  END IF;
  
  v_commission_nette := GREATEST(0, v_commission_base + v_bonus_survente - v_decom);
  
  RETURN jsonb_build_object(
    'vente_id', p_vente_id,
    'type', 'standard',
    'mode', 'bouquet',
    'commission_base', ROUND(v_commission_base, 2),
    'bonus_survente', ROUND(v_bonus_survente, 2),
    'decom_montant', v_decom,
    'commission_nette', ROUND(v_commission_nette, 2),
    'montant_ht', v_vente.montant_ht,
    'puissance_kwc', v_vente.puissance_kwc,
    'prix_recommande', v_prix_reco,
    'is_interpolated', v_is_interpolated
  );
END;
$function$;
