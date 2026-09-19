/**
 * Calcul de mensualité avec report de 6 mois (intérêts intercalaires)
 * 
 * Principe :
 * - Pendant les 6 premiers mois : paiement des intérêts uniquement
 * - Ces intérêts intercalaires sont ajoutés au capital
 * - Le prêt amortissable démarre ensuite sur la durée choisie
 * - Durée totale = 6 mois de report + durée du prêt
 */

/**
 * Mode de calcul configuré au niveau de la régie :
 * - report_interets : 6 mois (par défaut) d'intérêts seuls, puis amortissement
 * - amortissement_direct : amortissement classique dès la 1ʳᵉ échéance
 */
export type ModeCalculFinancement = "report_interets" | "amortissement_direct";

export interface CalculMensualiteParams {
  /** Montant total TTC à financer (hors aides) */
  montantTTC: number;
  /** Taux effectif annuel en % (ex: 5.9 pour 5.9%) */
  tauxEffectifAnnuel: number;
  /** Durée du prêt amortissable en mois (hors report) */
  dureeMois: number;
  /** Durée du report en mois (défaut: 6) */
  dureeReportMois?: number;
  /** Mode de calcul (défaut: report_interets) */
  mode?: ModeCalculFinancement;
  /** Frais de dossier en % du montant financé (défaut: 0) */
  fraisDossierPct?: number;
}

export interface ResultatFinancement {
  /** Mensualité pendant le report (intérêts seuls) */
  mensualiteReport: number;
  /** Mensualité après le report (capital + intérêts) */
  mensualiteAmortissement: number;
  /** Intérêts intercalaires (payés pendant le report) */
  interetsIntercalaires: number;
  /** Capital total financé (capital initial + intérêts intercalaires capitalisés si applicable) */
  capitalTotal: number;
  /** Coût total du crédit (hors capital initial) */
  coutTotalCredit: number;
  /** Durée totale en mois (report + amortissement) */
  dureeTotaleMois: number;
}

/**
 * Calcule les mensualités avec report de 6 mois
 * 
 * Mode : Report avec paiement des intérêts intercalaires mensuellement
 * - Pendant les 6 mois de report : paiement des intérêts mensuels sur le capital
 * - Après le report : mensualités classiques sur la durée choisie
 * 
 * @param params Paramètres du financement
 * @returns Résultat complet du financement
 */
export function calculerMensualiteAvecReport(params: CalculMensualiteParams): ResultatFinancement {
  const {
    montantTTC,
    tauxEffectifAnnuel,
    dureeMois,
    dureeReportMois = 6,
  } = params;

  // Cas sans financement ou montant nul
  if (montantTTC <= 0 || dureeMois <= 0) {
    return {
      mensualiteReport: 0,
      mensualiteAmortissement: 0,
      interetsIntercalaires: 0,
      capitalTotal: montantTTC,
      coutTotalCredit: 0,
      dureeTotaleMois: 0,
    };
  }

  const tauxMensuel = tauxEffectifAnnuel / 100 / 12;

  // Cas taux 0%
  if (tauxMensuel === 0) {
    return {
      mensualiteReport: 0,
      mensualiteAmortissement: montantTTC / dureeMois,
      interetsIntercalaires: 0,
      capitalTotal: montantTTC,
      coutTotalCredit: 0,
      dureeTotaleMois: dureeReportMois + dureeMois,
    };
  }

  // Intérêts mensuels pendant le report (payés chaque mois, non capitalisés)
  const interetsMensuelsReport = montantTTC * tauxMensuel;
  const interetsIntercalaires = interetsMensuelsReport * dureeReportMois;

  // Le capital reste inchangé car les intérêts sont payés mensuellement
  const capitalAFinancer = montantTTC;

  // Mensualité classique après le report (formule d'amortissement)
  const mensualiteAmortissement = 
    (capitalAFinancer * tauxMensuel * Math.pow(1 + tauxMensuel, dureeMois)) /
    (Math.pow(1 + tauxMensuel, dureeMois) - 1);

  // Coût total du crédit
  const totalRembourse = (mensualiteAmortissement * dureeMois) + interetsIntercalaires;
  const coutTotalCredit = totalRembourse - montantTTC;

  return {
    mensualiteReport: Math.round(interetsMensuelsReport * 100) / 100,
    mensualiteAmortissement: Math.round(mensualiteAmortissement * 100) / 100,
    interetsIntercalaires: Math.round(interetsIntercalaires * 100) / 100,
    capitalTotal: capitalAFinancer,
    coutTotalCredit: Math.round(coutTotalCredit * 100) / 100,
    dureeTotaleMois: dureeReportMois + dureeMois,
  };
}

/**
 * Calcul simplifié retournant uniquement la mensualité d'amortissement
 * (utilisé pour les affichages condensés)
 */
export function calculerMensualiteSimple(
  montantTTC: number,
  tauxEffectifAnnuel: number,
  dureeMois: number
): number {
  const result = calculerMensualiteAvecReport({
    montantTTC,
    tauxEffectifAnnuel,
    dureeMois,
  });
  return result.mensualiteAmortissement;
}
