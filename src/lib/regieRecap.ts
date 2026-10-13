import type { EtudeData } from "@/lib/exportEtudePdf";

export interface RegieRecapDetails {
  telephone?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  puissanceKwc?: number;
  prixTTC?: number;
  mensualiteCredit?: number;
  /** Mensualité après déduction des aides (calculée au prorata si absente). */
  mensualiteApresAides?: number;
  /** Durée du financement en mois (180 par défaut). */
  dureeFinancementMois?: number;
  consommationKwh?: number;
  factureAnnuelleEuros?: number;
  totalAides?: number;
  primeAutoconsommation?: number;
  ecoTva?: number;
  productType?: string;
}

export function studyRecapDetails(study?: Partial<EtudeData>): RegieRecapDetails {
  return {
    consommationKwh: study?.consoAnnuelle,
    factureAnnuelleEuros: study?.factureMensuelle == null ? undefined : study.factureMensuelle * 12,
    puissanceKwc: study?.puissanceKwc,
    prixTTC: study?.prixTotalHorsAides,
    mensualiteCredit: study?.mensualite,
    dureeFinancementMois: study?.dureeMois ?? 180,
    totalAides: study?.totalAides,
    primeAutoconsommation: study?.primeAutoconsommation,
    ecoTva: study?.ecoTva,
  };
}

/** Mensualité aides déduites : même ratio que le reste à charge sur le prix. */
export function mensualiteAfterAids(details: RegieRecapDetails): number | undefined {
  if (details.mensualiteApresAides != null) return details.mensualiteApresAides;
  const { mensualiteCredit: m, prixTTC: p, totalAides: a } = details;
  if (m == null || !p || a == null || !Number.isFinite(m)) return undefined;
  return Math.max(0, Math.round(m * (Math.max(0, p - a) / p) * 100) / 100);
}

export function formatRegieStudyDetails(details: RegieRecapDetails): string {
  const number = (value: number | undefined, unit: string) =>
    value == null || !Number.isFinite(value)
      ? "Non renseigné"
      : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unit}`;
  const mensuelle = details.factureAnnuelleEuros == null ? undefined : details.factureAnnuelleEuros / 12;
  const aides: string[] = [];
  if (details.primeAutoconsommation) aides.push(`   • Prime Coup de Pouce Producteur : ${number(details.primeAutoconsommation, "€")}`);
  if (details.ecoTva) aides.push(`   • Éco TVA : ${number(details.ecoTva, "€")}`);
  const other = (details.totalAides ?? 0) - (details.primeAutoconsommation ?? 0) - (details.ecoTva ?? 0);
  if (other > 0.5) aides.push(`   • Autres aides : ${number(other, "€")}`);
  return [
    `⚡ Conso : ${number(details.consommationKwh, "kWh/an")} / ${number(mensuelle, "€/mois")}`,
    `☀️ Puissance préconisée : ${number(details.puissanceKwc, "kWc")}`,
    `💰 Prix : ${number(details.prixTTC, "€ TTC")}`,
    `🎁 Aides : ${number(details.totalAides, "€")}`,
    ...aides,
    `💳 Mensualité avant aides : ${number(details.mensualiteCredit, "€/mois")} (${details.dureeFinancementMois ?? 180} mois)`,
    `💳 Mensualité aides déduites : ${number(mensualiteAfterAids(details), "€/mois")}`,
  ].join("\n");
}
