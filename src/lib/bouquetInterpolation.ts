/**
 * Utility functions for bouquet price interpolation
 * 
 * When no exact power match exists, interpolate based on nearest bouquet:
 * - 3.5 kWc: Use 4 kWc bouquet and subtract 500€
 * - Other powers: Use lower bouquet and add 1000€ per kWc difference
 */

interface BouquetData {
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe?: number | null;
}

export interface InterpolatedBouquet {
  prixRecommande: number;
  commissionFixe: number;
  isInterpolated: boolean;
  basedOnBouquet?: BouquetData;
}

/**
 * Find an exact bouquet match or interpolate if not found
 */
export function findOrInterpolateBouquet(
  bouquets: BouquetData[],
  targetPuissance: number,
  coutPanneauSupplementaire: number = 500
): InterpolatedBouquet {
  // First try exact match
  const exactMatch = bouquets.find(b => b.puissance_kwc === targetPuissance);
  if (exactMatch) {
    return {
      prixRecommande: exactMatch.prix_recommande,
      commissionFixe: exactMatch.commission_fixe || 0,
      isInterpolated: false,
      basedOnBouquet: exactMatch,
    };
  }

  const sortedBouquets = [...bouquets].sort((a, b) => a.puissance_kwc - b.puissance_kwc);

  // Special case for 3.5 kWc: use 4kWc and subtract 500€
  if (targetPuissance === 3.5) {
    const bouquet4kwc = sortedBouquets.find(b => b.puissance_kwc === 4);
    if (bouquet4kwc) {
      return {
        prixRecommande: bouquet4kwc.prix_recommande - 500,
        commissionFixe: bouquet4kwc.commission_fixe || 0,
        isInterpolated: true,
        basedOnBouquet: bouquet4kwc,
      };
    }
  }

  // Find the nearest lower bouquet - commission = bouquet inférieur, prix ajusté par panneaux supplémentaires
  const lowerBouquet = sortedBouquets.filter(b => b.puissance_kwc < targetPuissance).pop();
  const upperBouquet = sortedBouquets.find(b => b.puissance_kwc > targetPuissance);

  if (lowerBouquet) {
    const diffKwc = targetPuissance - lowerBouquet.puissance_kwc;
    const panelsExtra = diffKwc / 0.5; // chaque panneau = 500Wc = 0.5kWc
    const adjustment = panelsExtra * coutPanneauSupplementaire;
    return {
      prixRecommande: lowerBouquet.prix_recommande + adjustment,
      commissionFixe: lowerBouquet.commission_fixe || 0,
      isInterpolated: true,
      basedOnBouquet: lowerBouquet,
    };
  } else if (upperBouquet) {
    // If no lower bouquet exists, use upper and subtract
    const diffKwc = upperBouquet.puissance_kwc - targetPuissance;
    const panelsExtra = diffKwc / 0.5;
    const adjustment = panelsExtra * coutPanneauSupplementaire;
    return {
      prixRecommande: upperBouquet.prix_recommande - adjustment,
      commissionFixe: upperBouquet.commission_fixe || 0,
      isInterpolated: true,
      basedOnBouquet: upperBouquet,
    };
  }

  // No bouquets at all - return defaults
  return {
    prixRecommande: targetPuissance * 4500,
    commissionFixe: 0,
    isInterpolated: true,
  };
}

/**
 * Format interpolation explanation for display
 */
export function getInterpolationExplanation(
  targetPuissance: number,
  basedOnBouquet?: BouquetData
): string {
  if (!basedOnBouquet) {
    return `Prix estimé pour ${targetPuissance} kWc (aucun bouquet de référence)`;
  }

  if (targetPuissance === 3.5) {
    return `Basé sur ${basedOnBouquet.puissance_kwc} kWc - 500€`;
  }

  const diff = targetPuissance - basedOnBouquet.puissance_kwc;
  const sign = diff > 0 ? "+" : "";
  return `Basé sur ${basedOnBouquet.puissance_kwc} kWc ${sign}${diff * 1000}€`;
}
