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
  /** Frais de dossier (montant en €) */
  fraisDossier: number;
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
    mode = "report_interets",
    fraisDossierPct = 0,
  } = params;

  // `dureeMois` = DURÉE TOTALE du crédit (nombre total d'échéances, comme sur le simulateur
  // Projexio : 120, 180…). Le report est inclus dedans.
  const dureeReportMois = mode === "amortissement_direct" ? 0 : Math.max(0, params.dureeReportMois ?? 6);
  const dureeAmortissement = Math.max(1, dureeMois - dureeReportMois);
  const fraisDossier = Math.round(Math.max(0, montantTTC) * (fraisDossierPct / 100) * 100) / 100;

  if (montantTTC <= 0 || dureeMois <= 0) {
    return {
      mensualiteReport: 0, mensualiteAmortissement: 0, interetsIntercalaires: 0,
      capitalTotal: montantTTC, coutTotalCredit: 0, dureeTotaleMois: 0, fraisDossier: 0,
    };
  }

  const tauxMensuel = tauxEffectifAnnuel / 100 / 12;
  // Les frais de dossier sont financés (ajoutés au capital emprunté)
  const capitalEmprunte = montantTTC + fraisDossier;

  if (tauxMensuel === 0) {
    return {
      mensualiteReport: 0,
      mensualiteAmortissement: Math.round((capitalEmprunte / dureeAmortissement) * 100) / 100,
      interetsIntercalaires: 0,
      capitalTotal: capitalEmprunte,
      coutTotalCredit: fraisDossier,
      dureeTotaleMois: dureeReportMois + dureeAmortissement,
      fraisDossier,
    };
  }

  // Pendant le report : intérêts payés chaque mois, sauf le 1er mois (décalage de la
  // 1ʳᵉ échéance) dont l'intérêt est capitalisé — convention constatée sur Projexio.
  const interetsMensuelsReport = dureeReportMois > 0 ? capitalEmprunte * tauxMensuel : 0;
  const capitalAFinancer = dureeReportMois > 0 ? capitalEmprunte * (1 + tauxMensuel) : capitalEmprunte;
  const interetsIntercalaires = interetsMensuelsReport * Math.max(0, dureeReportMois - 1)
    + (capitalAFinancer - capitalEmprunte);

  const facteur = Math.pow(1 + tauxMensuel, dureeAmortissement);
  const mensualiteAmortissement = (capitalAFinancer * tauxMensuel * facteur) / (facteur - 1);

  const totalRembourse = mensualiteAmortissement * dureeAmortissement
    + interetsMensuelsReport * Math.max(0, dureeReportMois - 1);
  const coutTotalCredit = totalRembourse - montantTTC;

  return {
    mensualiteReport: Math.round(interetsMensuelsReport * 100) / 100,
    mensualiteAmortissement: Math.round(mensualiteAmortissement * 100) / 100,
    interetsIntercalaires: Math.round(interetsIntercalaires * 100) / 100,
    capitalTotal: Math.round(capitalAFinancer * 100) / 100,
    coutTotalCredit: Math.round(coutTotalCredit * 100) / 100,
    dureeTotaleMois: dureeReportMois + dureeAmortissement,
    fraisDossier,
  };
}

export interface ParametresFinancementRegie {
  tauxEffectifAnnuel: number;
  dureeMois: number;
  dureeReportMois?: number;
  mode?: ModeCalculFinancement;
  fraisDossierPct?: number;
}

/**
 * Calcul automatique des deux mensualités présentées au client :
 * avant aides (montant total) et après aides (reste à charge).
 */
export function calculerFinancementAvantApresAides(
  montantHorsAides: number,
  montantResteACharge: number,
  parametres: ParametresFinancementRegie,
): { avantAides: ResultatFinancement; apresAides: ResultatFinancement } {
  return {
    avantAides: calculerMensualiteAvecReport({ montantTTC: Math.max(0, montantHorsAides), ...parametres }),
    apresAides: calculerMensualiteAvecReport({ montantTTC: Math.max(0, montantResteACharge), ...parametres }),
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
