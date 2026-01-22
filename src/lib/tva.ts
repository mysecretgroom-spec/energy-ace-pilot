/**
 * Utilitaires de calcul TVA
 * Les prix de vente sont toujours saisis en TTC
 */

// Taux de TVA standard pour les installations photovoltaïques
export const TVA_RATES = {
  STANDARD: 20,        // Taux standard
  INTERMEDIAIRE: 10,   // Installations ≤ 3kWc sur logement > 2 ans
  REDUIT: 5.5,         // Travaux d'amélioration énergétique
} as const;

export type TVARate = typeof TVA_RATES[keyof typeof TVA_RATES];

/**
 * Convertit un montant TTC en HT
 * @param montantTTC Montant TTC
 * @param tauxTVA Taux de TVA en % (default: 10%)
 * @returns Montant HT
 */
export function ttcToHT(montantTTC: number, tauxTVA: number = TVA_RATES.INTERMEDIAIRE): number {
  if (montantTTC <= 0) return 0;
  return montantTTC / (1 + tauxTVA / 100);
}

/**
 * Convertit un montant HT en TTC
 * @param montantHT Montant HT
 * @param tauxTVA Taux de TVA en % (default: 10%)
 * @returns Montant TTC
 */
export function htToTTC(montantHT: number, tauxTVA: number = TVA_RATES.INTERMEDIAIRE): number {
  if (montantHT <= 0) return 0;
  return montantHT * (1 + tauxTVA / 100);
}

/**
 * Calcule le montant de TVA à partir d'un montant TTC
 * @param montantTTC Montant TTC
 * @param tauxTVA Taux de TVA en % (default: 10%)
 * @returns Montant de TVA
 */
export function calculerTVA(montantTTC: number, tauxTVA: number = TVA_RATES.INTERMEDIAIRE): number {
  if (montantTTC <= 0) return 0;
  return montantTTC - ttcToHT(montantTTC, tauxTVA);
}

/**
 * Détermine le taux de TVA applicable selon la puissance
 * @param puissanceKwc Puissance en kWc
 * @returns Taux de TVA applicable
 */
export function getTauxTVAByPuissance(puissanceKwc: number): number {
  // Installations ≤ 3kWc = TVA réduite 10%
  // Installations > 3kWc = TVA standard 20%
  return puissanceKwc <= 3 ? TVA_RATES.INTERMEDIAIRE : TVA_RATES.STANDARD;
}

/**
 * Formate un montant en euros
 */
export function formatEuros(montant: number, decimals: number = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: decimals,
  }).format(montant);
}
