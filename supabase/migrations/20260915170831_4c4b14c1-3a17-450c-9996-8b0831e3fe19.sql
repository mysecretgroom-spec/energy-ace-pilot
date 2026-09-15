CREATE OR REPLACE FUNCTION public.calculate_vente_commission(p_vente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vente RECORD;
  v_regie RECORD;
  v_config RECORD;
  v_tier RECORD;
  v_mode TEXT;
  v_commission_base NUMERIC := 0;
  v_bonus_survente NUMERIC := 0;
  v_decom NUMERIC := 0;
  v_commission_nette NUMERIC := 0;
  v_part_survente_pct NUMERIC := 50;
  v_taux_tva NUMERIC;
  v_montant_ttc NUMERIC;
  v_prix_reco NUMERIC := 0;
  v_total_surcouts NUMERIC := 0;
  v_survente_ht NUMERIC;
  v_is_interpolated BOOLEAN := false;
  v_taux_applique NUMERIC;
  v_product_type TEXT;
  v_cout_panneau NUMERIC := 500;
  v_ref_bouquet RECORD;
  v_diff_kwc NUMERIC;
  v_panels_extra NUMERIC;
  v_found_exact BOOLEAN := false;
  v_gamme TEXT;
  v_gamme_used TEXT;
  v_ref_price NUMERIC;
BEGIN
  SELECT * INTO v_vente FROM ventes WHERE id = p_vente_id;
  IF v_vente IS NULL THEN
    RETURN jsonb_build_object('error', 'Vente non trouvée');
  END IF;

  v_decom := COALESCE(v_vente.decom_montant, 0);
  v_product_type := v_vente.product_type;
  v_gamme := NULLIF(TRIM(COALESCE(v_vente.gamme, '')), '');

  IF v_vente.commission_override IS NOT NULL THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id,
      'type', CASE WHEN v_vente.type_vente = 'external_installation' THEN 'external' ELSE 'standard' END,
      'mode', 'override', 'commission_base', v_vente.commission_override,
      'bonus_survente', 0, 'decom_montant', v_decom,
      'commission_nette', GREATEST(0, v_vente.commission_override - v_decom),
      'montant_ht', v_vente.montant_ht, 'is_interpolated', false, 'is_override', true
    );
  END IF;

  IF v_vente.status = 'annule' THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id, 'type', 'cancelled', 'mode', 'none',
      'commission_base', 0, 'bonus_survente', 0, 'decom_montant', v_decom,
      'commission_nette', 0, 'montant_ht', v_vente.montant_ht
    );
  END IF;

  IF v_vente.type_vente = 'external_installation' THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id, 'type', 'external', 'mode', 'externe',
      'commission_base', v_vente.montant_ht, 'bonus_survente', 0,
      'decom_montant', v_decom, 'commission_nette', GREATEST(0, v_vente.montant_ht - v_decom),
      'montant_ht', v_vente.montant_ht
    );
  END IF;

  IF v_vente.regie_id IS NOT NULL THEN
    SELECT mode_calcul_commission, part_survente_pct, cout_panneau_supplementaire INTO v_regie
    FROM regies WHERE id = v_vente.regie_id;
    v_mode := COALESCE(v_regie.mode_calcul_commission, 'bouquet');
    v_part_survente_pct := COALESCE(v_regie.part_survente_pct, 50);
    v_cout_panneau := COALESCE(v_regie.cout_panneau_supplementaire, 500);
  ELSE
    SELECT mode_calcul, part_survente_pct INTO v_config FROM config_commissions LIMIT 1;
    v_mode := COALESCE(v_config.mode_calcul, 'bouquet');
    v_part_survente_pct := COALESCE(v_config.part_survente_pct, 50);
  END IF;

  IF v_mode = 'pourcentage' THEN
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
    v_commission_nette := ROUND(v_commission_nette / 100) * 100;
    RETURN jsonb_build_object(
      'vente_id', p_vente_id, 'type', 'standard', 'mode', 'pourcentage',
      'commission_base', ROUND(v_commission_base, 2), 'bonus_survente', ROUND(v_bonus_survente, 2),
      'decom_montant', v_decom, 'commission_nette', v_commission_nette,
      'montant_ht', v_vente.montant_ht, 'taux_applique', v_taux_applique
    );
  END IF;

  -- MODE BOUQUET
  IF v_vente.puissance_kwc IS NULL OR v_vente.puissance_kwc <= 0 THEN
    RETURN jsonb_build_object(
      'vente_id', p_vente_id, 'type', 'standard', 'mode', 'bouquet',
      'commission_base', 0, 'bonus_survente', 0, 'decom_montant', v_decom,
      'commission_nette', 0, 'montant_ht', v_vente.montant_ht, 'error', 'Puissance manquante'
    );
  END IF;

  -- Référence de prix pour départager deux gammes de même puissance
  v_taux_tva := CASE WHEN v_vente.puissance_kwc <= 3 THEN 10 ELSE 20 END;
  v_montant_ttc := COALESCE(v_vente.montant_ttc, v_vente.montant_ht * (1 + v_taux_tva / 100));
  IF v_vente.etude_id IS NOT NULL THEN
    SELECT COALESCE(surcout_support, 0) + COALESCE(surcout_compteur, 0) + COALESCE(autre_surcout, 0)
    INTO v_total_surcouts FROM etudes WHERE id = v_vente.etude_id;
  END IF;
  v_ref_price := COALESCE(v_montant_ttc, 0) - COALESCE(v_total_surcouts, 0);

  -- Bouquet exact régie (filtré par gamme si renseignée)
  IF v_vente.regie_id IS NOT NULL THEN
    SELECT commission_fixe, prix_recommande, gamme INTO v_commission_base, v_prix_reco, v_gamme_used
    FROM bouquets
    WHERE actif = true AND puissance_kwc = v_vente.puissance_kwc
      AND v_vente.regie_id = ANY(regie_ids)
      AND (v_product_type IS NULL OR product_type::text = v_product_type)
      AND (v_gamme IS NULL OR LOWER(TRIM(COALESCE(gamme, ''))) = LOWER(v_gamme))
    ORDER BY ABS(COALESCE(prix_recommande, 0) - v_ref_price)
    LIMIT 1;
    IF FOUND THEN v_found_exact := true; END IF;
  END IF;

  -- Fallback bouquet global exact
  IF NOT v_found_exact THEN
    SELECT commission_fixe, prix_recommande, gamme INTO v_commission_base, v_prix_reco, v_gamme_used
    FROM bouquets
    WHERE actif = true AND puissance_kwc = v_vente.puissance_kwc
      AND (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL)
      AND (v_product_type IS NULL OR product_type::text = v_product_type)
      AND (v_gamme IS NULL OR LOWER(TRIM(COALESCE(gamme, ''))) = LOWER(v_gamme))
    ORDER BY ABS(COALESCE(prix_recommande, 0) - v_ref_price)
    LIMIT 1;
    IF FOUND THEN v_found_exact := true; END IF;
  END IF;

  -- INTERPOLATION
  IF NOT v_found_exact THEN
    v_is_interpolated := true;

    SELECT commission_fixe, prix_recommande, puissance_kwc, gamme INTO v_ref_bouquet
    FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc
      AND (
        (v_vente.regie_id IS NOT NULL AND v_vente.regie_id = ANY(regie_ids))
        OR (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL)
      )
      AND (v_product_type IS NULL OR product_type::text = v_product_type)
      AND (v_gamme IS NULL OR LOWER(TRIM(COALESCE(gamme, ''))) = LOWER(v_gamme))
    ORDER BY
      CASE WHEN v_vente.regie_id IS NOT NULL AND v_vente.regie_id = ANY(regie_ids) THEN 0 ELSE 1 END,
      puissance_kwc DESC
    LIMIT 1;

    IF v_ref_bouquet IS NOT NULL THEN
      v_diff_kwc := v_vente.puissance_kwc - v_ref_bouquet.puissance_kwc;
      v_panels_extra := v_diff_kwc / 0.5;
      v_commission_base := COALESCE(v_ref_bouquet.commission_fixe, 0);
      v_prix_reco := v_ref_bouquet.prix_recommande + (v_panels_extra * v_cout_panneau);
      v_gamme_used := v_ref_bouquet.gamme;
    ELSE
      SELECT commission_fixe, prix_recommande, puissance_kwc, gamme INTO v_ref_bouquet
      FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc
        AND (
          (v_vente.regie_id IS NOT NULL AND v_vente.regie_id = ANY(regie_ids))
          OR (regie_ids IS NULL OR array_length(regie_ids, 1) IS NULL)
        )
        AND (v_product_type IS NULL OR product_type::text = v_product_type)
        AND (v_gamme IS NULL OR LOWER(TRIM(COALESCE(gamme, ''))) = LOWER(v_gamme))
      ORDER BY
        CASE WHEN v_vente.regie_id IS NOT NULL AND v_vente.regie_id = ANY(regie_ids) THEN 0 ELSE 1 END,
        puissance_kwc ASC
      LIMIT 1;

      IF v_ref_bouquet IS NOT NULL THEN
        v_diff_kwc := v_ref_bouquet.puissance_kwc - v_vente.puissance_kwc;
        v_panels_extra := v_diff_kwc / 0.5;
        v_commission_base := COALESCE(v_ref_bouquet.commission_fixe, 0);
        v_prix_reco := v_ref_bouquet.prix_recommande - (v_panels_extra * v_cout_panneau);
        v_gamme_used := v_ref_bouquet.gamme;
      ELSE
        v_commission_base := 0;
        v_prix_reco := v_vente.puissance_kwc * 4500;
        v_gamme_used := NULL;
      END IF;
    END IF;
  END IF;

  v_commission_base := COALESCE(v_commission_base, 0);
  v_prix_reco := COALESCE(v_prix_reco, 0);

  IF v_prix_reco > 0 AND v_ref_price > v_prix_reco THEN
    v_survente_ht := (v_ref_price - v_prix_reco) / (1 + v_taux_tva / 100);
    v_bonus_survente := v_survente_ht * (v_part_survente_pct / 100);
  END IF;

  v_commission_nette := GREATEST(0, v_commission_base + v_bonus_survente - v_decom);
  v_commission_nette := ROUND(v_commission_nette / 100) * 100;

  RETURN jsonb_build_object(
    'vente_id', p_vente_id, 'type', 'standard', 'mode', 'bouquet',
    'commission_base', ROUND(v_commission_base, 2), 'bonus_survente', ROUND(v_bonus_survente, 2),
    'decom_montant', v_decom, 'commission_nette', v_commission_nette,
    'montant_ht', v_vente.montant_ht, 'puissance_kwc', v_vente.puissance_kwc,
    'prix_recommande', v_prix_reco, 'is_interpolated', v_is_interpolated,
    'gamme', COALESCE(v_gamme, v_gamme_used)
  );
END;
$function$;