import type { EtudeData } from "@/lib/exportEtudePdf";

export interface RegieRecapDetails {
  telephone?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  puissanceKwc?: number;
  prixTTC?: number;
  mensualiteCredit?: number;
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
  };
}

export function formatRegieStudyDetails(details: RegieRecapDetails): string {
  const number = (value: number | undefined, unit: string) =>
    value == null || !Number.isFinite(value)
      ? "Non renseigné"
      : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unit}`;
  return [
    `⚡ Conso : ${number(details.consommationKwh, "kWh/an")} / ${number(details.factureAnnuelleEuros, "€/an")}`,
    `☀️ Puissance préconisée : ${number(details.puissanceKwc, "kWc")}`,
    `💰 Prix : ${number(details.prixTTC, "€ TTC")} / Mensualité crédit : ${number(details.mensualiteCredit, "€/mois")}`,
  ].join("\n");
}