-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTIONS RPC PARTAGÉES - BATCH 2
-- Dashboard KPIs, Planning RDV, Recherche fuzzy, Résumé frais
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DASHBOARD KPIs - Progression vs Objectifs
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_user_id UUID,
  p_month INTEGER DEFAULT NULL,
  p_year INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_objectif RECORD;
  v_rdv_count INT := 0;
  v_ventes_count INT := 0;
  v_ca_ttc NUMERIC := 0;
  v_ca_ht NUMERIC := 0;
  v_ventes_en_cours INT := 0;
  v_taux_conversion NUMERIC := 0;
BEGIN
  -- Default to current month/year
  v_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::INT);
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
  
  v_start_date := make_date(v_year, v_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get objectives
  SELECT * INTO v_objectif FROM objectifs 
  WHERE user_id = p_user_id AND mois = v_month AND annee = v_year;
  
  -- Count RDV (excluding cancelled/postponed)
  SELECT COUNT(*) INTO v_rdv_count FROM rdv
  WHERE user_id = p_user_id
    AND date_heure::date >= v_start_date
    AND date_heure::date <= v_end_date
    AND status NOT IN ('annule', 'reporte');
  
  -- Count sales and CA (by signature date, excluding external installations)
  SELECT 
    COUNT(*),
    COALESCE(SUM(montant_ttc), 0),
    COALESCE(SUM(montant_ht), 0)
  INTO v_ventes_count, v_ca_ttc, v_ca_ht
  FROM ventes
  WHERE user_id = p_user_id
    AND date_signature >= v_start_date
    AND date_signature <= v_end_date
    AND status != 'annule'
    AND type_vente != 'external_installation';
  
  -- Count ongoing sales
  SELECT COUNT(*) INTO v_ventes_en_cours FROM ventes
  WHERE user_id = p_user_id
    AND status IN ('signe', 'cq_a_faire', 'cq_fait', 'attente_financement', 'envoi_pose');
  
  -- Conversion rate
  IF v_rdv_count > 0 THEN
    v_taux_conversion := ROUND((v_ventes_count::NUMERIC / v_rdv_count * 100)::NUMERIC, 1);
  END IF;
  
  RETURN jsonb_build_object(
    'periode', jsonb_build_object('mois', v_month, 'annee', v_year),
    'objectifs', jsonb_build_object(
      'rdv', COALESCE(v_objectif.objectif_rdv, 0),
      'ventes', COALESCE(v_objectif.objectif_ventes, 0),
      'ca', COALESCE(v_objectif.objectif_ca, 0)
    ),
    'realise', jsonb_build_object(
      'rdv', v_rdv_count,
      'ventes', v_ventes_count,
      'ca_ttc', ROUND(v_ca_ttc, 2),
      'ca_ht', ROUND(v_ca_ht, 2)
    ),
    'progression', jsonb_build_object(
      'rdv_pct', CASE WHEN COALESCE(v_objectif.objectif_rdv, 0) > 0 
                 THEN ROUND((v_rdv_count::NUMERIC / v_objectif.objectif_rdv * 100)::NUMERIC, 1) ELSE 0 END,
      'ventes_pct', CASE WHEN COALESCE(v_objectif.objectif_ventes, 0) > 0 
                    THEN ROUND((v_ventes_count::NUMERIC / v_objectif.objectif_ventes * 100)::NUMERIC, 1) ELSE 0 END,
      'ca_pct', CASE WHEN COALESCE(v_objectif.objectif_ca, 0) > 0 
                THEN ROUND((v_ca_ttc / v_objectif.objectif_ca * 100)::NUMERIC, 1) ELSE 0 END
    ),
    'ventes_en_cours', v_ventes_en_cours,
    'taux_conversion', v_taux_conversion
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PLANNING RDV - Liste avec clients et coordonnées
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_rdv_planning(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_include_cancelled BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'date_heure', r.date_heure,
      'status', r.status,
      'type_rdv', r.type_rdv,
      'is_r2', CASE WHEN e.r2_date_heure IS NOT NULL THEN true ELSE false END,
      'client', jsonb_build_object(
        'id', c.id,
        'nom', c.nom,
        'prenom', c.prenom,
        'adresse', c.adresse,
        'ville', c.ville,
        'code_postal', c.code_postal,
        'telephone', c.telephone,
        'latitude', c.latitude,
        'longitude', c.longitude
      ),
      'regie', CASE WHEN reg.id IS NOT NULL THEN jsonb_build_object(
        'id', reg.id,
        'nom', reg.nom,
        'couleur', reg.couleur
      ) ELSE NULL END,
      'etude_id', e.id
    ) ORDER BY r.date_heure
  ), '[]'::JSONB) INTO v_result
  FROM rdv r
  JOIN clients c ON r.client_id = c.id
  LEFT JOIN etudes e ON e.rdv_id = r.id
  LEFT JOIN regies reg ON r.regie_id = reg.id
  WHERE r.user_id = p_user_id
    AND r.date_heure::date >= p_start_date
    AND r.date_heure::date <= p_end_date
    AND (p_include_cancelled OR r.status NOT IN ('annule', 'reporte'));
  
  RETURN jsonb_build_object(
    'periode', jsonb_build_object('debut', p_start_date, 'fin', p_end_date),
    'count', jsonb_array_length(v_result),
    'rdvs', v_result
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RECHERCHE CLIENT FUZZY - Algorithme Levenshtein
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_client_fuzzy(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_query_lower TEXT;
  v_result JSONB := '[]'::JSONB;
BEGIN
  v_query_lower := LOWER(TRIM(p_query));
  
  IF LENGTH(v_query_lower) < 2 THEN
    RETURN jsonb_build_object('results', '[]'::JSONB, 'count', 0);
  END IF;
  
  -- Search with fuzzy matching using trigram similarity + Levenshtein
  -- Priority: exact match > starts with > contains > fuzzy
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nom', nom,
      'prenom', prenom,
      'full_name', TRIM(COALESCE(prenom, '') || ' ' || nom),
      'telephone', telephone,
      'adresse', adresse,
      'ville', ville,
      'code_postal', code_postal,
      'email', email,
      'score', score
    ) ORDER BY score DESC
  ), '[]'::JSONB) INTO v_result
  FROM (
    SELECT 
      c.*,
      CASE 
        -- Exact match on full name
        WHEN LOWER(TRIM(COALESCE(c.prenom, '') || ' ' || c.nom)) = v_query_lower THEN 100
        WHEN LOWER(c.nom) = v_query_lower OR LOWER(COALESCE(c.prenom, '')) = v_query_lower THEN 95
        -- Starts with
        WHEN LOWER(c.nom) LIKE v_query_lower || '%' OR LOWER(COALESCE(c.prenom, '')) LIKE v_query_lower || '%' THEN 80
        -- Contains
        WHEN LOWER(c.nom) LIKE '%' || v_query_lower || '%' OR LOWER(COALESCE(c.prenom, '')) LIKE '%' || v_query_lower || '%' THEN 60
        -- Levenshtein distance (fuzzy) - lower distance = higher score
        ELSE GREATEST(0, 50 - LEAST(
          levenshtein(LOWER(c.nom), v_query_lower),
          levenshtein(LOWER(COALESCE(c.prenom, '')), v_query_lower)
        ) * 5)
      END as score
    FROM clients c
    WHERE c.user_id = p_user_id
      AND (
        LOWER(c.nom) LIKE '%' || v_query_lower || '%'
        OR LOWER(COALESCE(c.prenom, '')) LIKE '%' || v_query_lower || '%'
        OR LOWER(TRIM(COALESCE(c.prenom, '') || ' ' || c.nom)) LIKE '%' || v_query_lower || '%'
        OR levenshtein(LOWER(c.nom), v_query_lower) <= 3
        OR levenshtein(LOWER(COALESCE(c.prenom, '')), v_query_lower) <= 3
      )
    ORDER BY score DESC
    LIMIT p_limit
  ) ranked;
  
  RETURN jsonb_build_object(
    'query', p_query,
    'count', jsonb_array_length(v_result),
    'results', v_result
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RÉSUMÉ FRAIS - Total par catégorie et période
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_frais_summary(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_total NUMERIC := 0;
  v_categories JSONB := '[]'::JSONB;
  v_by_month JSONB := '[]'::JSONB;
BEGIN
  -- Default to current month
  v_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::DATE);
  v_end := COALESCE(p_end_date, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE);
  
  -- Total
  SELECT COALESCE(SUM(montant), 0) INTO v_total
  FROM frais
  WHERE user_id = p_user_id
    AND date_frais >= v_start
    AND date_frais <= v_end;
  
  -- By category
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'categorie', categorie::TEXT,
      'total', total,
      'count', cnt,
      'percentage', CASE WHEN v_total > 0 THEN ROUND((total / v_total * 100)::NUMERIC, 1) ELSE 0 END
    ) ORDER BY total DESC
  ), '[]'::JSONB) INTO v_categories
  FROM (
    SELECT 
      categorie,
      SUM(montant) as total,
      COUNT(*) as cnt
    FROM frais
    WHERE user_id = p_user_id
      AND date_frais >= v_start
      AND date_frais <= v_end
    GROUP BY categorie
  ) cat;
  
  -- By month (for longer periods)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'mois', to_char(mois, 'YYYY-MM'),
      'total', total
    ) ORDER BY mois
  ), '[]'::JSONB) INTO v_by_month
  FROM (
    SELECT 
      date_trunc('month', date_frais) as mois,
      SUM(montant) as total
    FROM frais
    WHERE user_id = p_user_id
      AND date_frais >= v_start
      AND date_frais <= v_end
    GROUP BY date_trunc('month', date_frais)
  ) monthly;
  
  RETURN jsonb_build_object(
    'periode', jsonb_build_object('debut', v_start, 'fin', v_end),
    'total', ROUND(v_total, 2),
    'par_categorie', v_categories,
    'par_mois', v_by_month
  );
END;
$$;