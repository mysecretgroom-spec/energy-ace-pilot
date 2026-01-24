/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES DE COMMISSION - 2 MODES DE CALCUL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Le mode de calcul est défini par régie (mode_calcul_commission) :
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ MODE 1: BOUQUET + SURVENTE (mode_calcul_commission = 'bouquet')        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = Commission Fixe (par kWc) + Bonus Survente - Décom        │
 * │                                                                         │
 * │ • Commission Fixe : Montant fixe défini par bouquet (puissance)        │
 * │ • Bonus Survente  : X% de la marge HT au-dessus du prix recommandé     │
 * │   - Marge = Prix vendu TTC - Surcoûts techniques - Prix reco TTC       │
 * │   - Marge convertie en HT puis × part_survente_pct                     │
 * │ • Décom           : Frais de décommissionnement déduits                │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ MODE 2: POURCENTAGE SUR CA (mode_calcul_commission = 'pourcentage')    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = Montant HT × Taux (%) selon tranche - Décom               │
 * │                                                                         │
 * │ • Tranches définies dans data_commissions (tranche_min/max)            │
 * │ • Chaque tranche a un taux_commission (%)                              │
 * │ • Bonus survente possible sur les tranches hautes                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ POSE EXTERNE (type_vente = 'external_installation')                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = Montant HT - Décom (le montant_ht EST la commission)      │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ VENTE ANNULÉE                                                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = 0                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/** Mode de calcul de commission */
export type CommissionMode = "bouquet" | "pourcentage";

/** Type de vente */
export type VenteType = "standard" | "external_installation";

/**
 * Résultat du calcul de commission pour une vente
 */
export interface CommissionResult {
  venteId: string;
  type: VenteType;
  mode: CommissionMode;
  /** Commission de base (fixe bouquet OU % CA) */
  commissionBase: number;
  /** Bonus survente (si applicable) */
  bonusSurvente: number;
  /** Montant décom déduit */
  decomMontant: number;
  /** Commission nette finale = base + survente - décom */
  commissionNette: number;
  /** Montant HT de la vente (référence) */
  montantHT: number;
  /** Taux appliqué (pour mode pourcentage) */
  tauxApplique?: number;
  /** Indique si le bouquet a été interpolé */
  isInterpolated: boolean;
}

/**
 * Tranche de commission (mode pourcentage)
 */
export interface CommissionTier {
  trancheMin: number;
  trancheMax: number;
  tauxCommission: number;
  bonusSurvente: number;
}

/**
 * Surcoûts techniques à déduire avant calcul de survente
 */
export interface SurcoutsTechniques {
  surcoutSupport: number;
  surcoutCompteur: number;
  autreSurcout: number;
}

/**
 * Calcule le total des surcoûts techniques
 */
export function getTotalSurcouts(surcouts: SurcoutsTechniques | null): number {
  if (!surcouts) return 0;
  return (surcouts.surcoutSupport || 0) + 
         (surcouts.surcoutCompteur || 0) + 
         (surcouts.autreSurcout || 0);
}

/**
 * Crée un résultat de commission à zéro
 */
export function createZeroCommission(venteId: string, montantHT: number = 0): CommissionResult {
  return {
    venteId,
    type: "standard",
    mode: "bouquet",
    commissionBase: 0,
    bonusSurvente: 0,
    decomMontant: 0,
    commissionNette: 0,
    montantHT,
    isInterpolated: false,
  };
}

/**
 * Crée un résultat de commission pour une pose externe
 */
export function createExternalCommission(
  venteId: string, 
  montantHT: number, 
  decomMontant: number = 0
): CommissionResult {
  return {
    venteId,
    type: "external_installation",
    mode: "bouquet",
    commissionBase: montantHT,
    bonusSurvente: 0,
    decomMontant,
    commissionNette: Math.max(0, montantHT - decomMontant),
    montantHT,
    isInterpolated: false,
  };
}
