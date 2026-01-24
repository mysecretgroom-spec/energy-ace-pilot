/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES DE COMMISSION - LOGIQUE SIMPLIFIÉE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Il n'existe que 2 types de ventes avec calcul de commission distinct :
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TYPE 1: VENTE STANDARD (installation photovoltaïque complète)          │
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
 * │ TYPE 2: POSE EXTERNE (installation uniquement, sans matériel)          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = Montant HT de la prestation - Décom                       │
 * │                                                                         │
 * │ • Pas de bouquet (pas de matériel vendu)                               │
 * │ • Pas de survente (prestation à prix fixe)                             │
 * │ • Le montant_ht EST la commission brute                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ VENTE ANNULÉE                                                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ Commission = 0 (aucun calcul)                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Type de vente pour déterminer le mode de calcul de commission
 */
export type VenteType = "standard" | "external_installation";

/**
 * Résultat du calcul de commission pour une vente
 */
export interface CommissionResult {
  /** ID de la vente */
  venteId: string;
  
  /** Type de vente */
  type: VenteType;
  
  /** Commission de base (fixe pour standard, montant HT pour externe) */
  commissionBase: number;
  
  /** Bonus survente (uniquement pour ventes standard) */
  bonusSurvente: number;
  
  /** Montant décom déduit */
  decomMontant: number;
  
  /** Commission nette finale = base + survente - décom */
  commissionNette: number;
  
  /** Montant HT de la vente (référence) */
  montantHT: number;
  
  /** Indique si le bouquet a été interpolé (pour ventes standard) */
  isInterpolated: boolean;
}

/**
 * Configuration des commissions (globale ou par régie)
 */
export interface CommissionConfig {
  /** Pourcentage de la survente reversé au commercial */
  partSurventePct: number;
}

/**
 * Données d'un bouquet de prix
 */
export interface BouquetPrix {
  puissanceKwc: number;
  prixRecommandeTTC: number;
  prixMaxTTC: number;
  commissionFixe: number;
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
 * Crée un résultat de commission à zéro (vente annulée ou données manquantes)
 */
export function createZeroCommission(venteId: string, montantHT: number = 0): CommissionResult {
  return {
    venteId,
    type: "standard",
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
    commissionBase: montantHT,
    bonusSurvente: 0,
    decomMontant,
    commissionNette: Math.max(0, montantHT - decomMontant),
    montantHT,
    isInterpolated: false,
  };
}
