-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTIONS RPC PARTAGÉES : COMMISSIONS & STATS
-- Réutilisables par le Frontend et l'Agent IA (WhatsApp/Web)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CALCUL DE COMMISSION POUR UNE VENTE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_vente_commission(p_vente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Récupérer la vente
  SELECT * INTO v_vente FROM ventes WHERE id = p_vente_id;
  IF v_vente IS NULL THEN
    RETURN jsonb_build_object('error', 'Vente non trouvée');
  END IF;
  
  v_decom := COALESCE(v_vente.decom_montant, 0);
  
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
    SELECT * INTO v_tier FROM data_commissions 
    WHERE v_vente.montant_ht >= tranche_min AND v_vente.montant_ht <= tranche_max
    ORDER BY tranche_min LIMIT 1;
    
    IF v_tier IS NULL THEN
      SELECT * INTO v_tier FROM data_commissions ORDER BY tranche_max DESC LIMIT 1;
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
  
  -- Chercher bouquet exact ou interpoler
  SELECT commission_fixe, prix_recommande INTO v_bouquet
  FROM bouquets 
  WHERE actif = true 
    AND puissance_kwc = v_vente.puissance_kwc
    AND (regie_ids IS NULL OR v_vente.regie_id = ANY(regie_ids))
  LIMIT 1;
  
  IF v_bouquet IS NULL THEN
    -- Interpolation entre bouquets
    WITH bounds AS (
      SELECT 
        (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc ORDER BY puissance_kwc DESC LIMIT 1) as lower_comm,
        (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc ORDER BY puissance_kwc DESC LIMIT 1) as lower_kwc,
        (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc < v_vente.puissance_kwc ORDER BY puissance_kwc DESC LIMIT 1) as lower_prix,
        (SELECT commission_fixe FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc ORDER BY puissance_kwc ASC LIMIT 1) as upper_comm,
        (SELECT puissance_kwc FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc ORDER BY puissance_kwc ASC LIMIT 1) as upper_kwc,
        (SELECT prix_recommande FROM bouquets WHERE actif = true AND puissance_kwc > v_vente.puissance_kwc ORDER BY puissance_kwc ASC LIMIT 1) as upper_prix
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
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. STATS MENSUELLES POUR UN UTILISATEUR
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_monthly_stats(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('reporte', 'annule')),
    COUNT(*)
  INTO v_rdv_confirme, v_rdv_total
  FROM rdv
  WHERE user_id = p_user_id
    AND date_heure::date >= p_start_date
    AND date_heure::date <= p_end_date;
  
  -- Ventes signées (par date_signature, excluant external_installation et annule)
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
  
  -- Ventes en cours (signées mais pas encore installées)
  SELECT COUNT(*) INTO v_ventes_en_cours
  FROM ventes
  WHERE user_id = p_user_id
    AND status IN ('signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose');
  
  -- Calcul du taux de conversion
  IF v_rdv_confirme > 0 THEN
    v_taux_conversion := ROUND((v_ventes_signees::NUMERIC / v_rdv_confirme * 100)::NUMERIC, 1);
  END IF;
  
  -- Calcul des commissions pour toutes les ventes de la période
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
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. COMMISSIONS PAR STATUT (En cours, À facturer, Payées)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_commissions_by_category(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_en_cours NUMERIC := 0;
  v_a_facturer NUMERIC := 0;
  v_payees NUMERIC := 0;
  v_vente RECORD;
  v_commission JSONB;
  v_two_weeks_ago DATE := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  FOR v_vente IN 
    SELECT id, status, date_installation_reelle FROM ventes 
    WHERE user_id = p_user_id AND status != 'annule'
  LOOP
    v_commission := calculate_vente_commission(v_vente.id);
    
    IF v_vente.status IN ('signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose') THEN
      -- En cours (pas encore installé)
      v_en_cours := v_en_cours + COALESCE((v_commission->>'commission_nette')::NUMERIC, 0);
    ELSIF v_vente.status = 'installe' AND v_vente.date_installation_reelle > v_two_weeks_ago THEN
      -- Installé depuis moins de 2 semaines (pas encore facturable)
      v_en_cours := v_en_cours + COALESCE((v_commission->>'commission_nette')::NUMERIC, 0);
    ELSIF v_vente.status IN ('attente_paiement', 'installe') AND (v_vente.date_installation_reelle IS NULL OR v_vente.date_installation_reelle <= v_two_weeks_ago) THEN
      -- À facturer
      v_a_facturer := v_a_facturer + COALESCE((v_commission->>'commission_nette')::NUMERIC, 0);
    ELSIF v_vente.status = 'paye' THEN
      -- Payées
      v_payees := v_payees + COALESCE((v_commission->>'commission_nette')::NUMERIC, 0);
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'en_cours', ROUND(v_en_cours, 2),
    'a_facturer', ROUND(v_a_facturer, 2),
    'payees', ROUND(v_payees, 2),
    'total', ROUND(v_en_cours + v_a_facturer + v_payees, 2)
  );
END;
$$;