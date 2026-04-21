/**
 * Centralised mappings to convert technical codes (DB enums, internal values)
 * into human-friendly French labels for display in UI/PDF.
 */

export type LabelDictionary = Record<string, string>;

const CLASSIFICATION_LABELS: LabelDictionary = {
  nouveau: "Nouveau",
  reporte: "Reporté",
  r2: "R2 — Second rendez-vous",
  r2_prestudy: "R2 — Pré-étude",
  signe: "Signé",
  positif: "Signé",
  negatif: "Négatif",
  annule: "Annulé",
  attente: "En attente",
  installe: "Installation terminée",
  paye: "Paiement reçu",
};

const SURCOUT_TYPE_CALCUL_LABELS: LabelDictionary = {
  fixe: "Forfait",
  forfait: "Forfait",
  par_panneau: "Par panneau",
  par_m2: "Au m²",
  par_ml: "Au mètre linéaire",
  par_metre: "Au mètre",
  par_kwc: "Au kWc",
  variable: "Variable",
};

const NOTIFICATION_STATUS_LABELS: LabelDictionary = {
  sent: "Envoyée",
  delivered: "Distribuée",
  failed: "Échec",
  pending: "En attente",
  scheduled: "Planifiée",
  cancelled: "Annulée",
  read: "Lue",
};

const PAC_SUBTYPE_LABELS: LabelDictionary = {
  air_air: "Air / Air",
  air_eau: "Air / Eau",
  eau_eau: "Eau / Eau",
  geothermique: "Géothermique",
  hybride: "Hybride",
};

const PRODUCT_TYPE_LABELS: LabelDictionary = {
  PV: "Photovoltaïque",
  PAC: "Pompe à chaleur",
  ITE: "Isolation extérieure",
};

const VERDICT_LABELS: LabelDictionary = {
  valide: "Étude validée",
  invalide: "Étude non validée",
  partiel: "Validation partielle",
  favorable: "Tendance favorable",
  defavorable: "Tendance défavorable",
};

/**
 * Generic prettifier: turns "snake_case_value" into "Snake case value".
 */
export function humanise(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value.toString().trim().replace(/[_-]+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function lookup(dict: LabelDictionary, value: string | null | undefined, fallback?: string) {
  if (!value) return fallback ?? "";
  const key = value.toString().toLowerCase().trim();
  return dict[key] || fallback || humanise(value);
}

export const formatClassification = (v: string | null | undefined, fallback = "Non classifié") =>
  lookup(CLASSIFICATION_LABELS, v, fallback);

export const formatTypeCalcul = (v: string | null | undefined, fallback = "—") =>
  lookup(SURCOUT_TYPE_CALCUL_LABELS, v, fallback);

export const formatNotificationStatus = (v: string | null | undefined, fallback = "Inconnu") =>
  lookup(NOTIFICATION_STATUS_LABELS, v, fallback);

export const formatPacSubtype = (v: string | null | undefined, fallback = "—") =>
  lookup(PAC_SUBTYPE_LABELS, v, fallback);

export const formatProductType = (v: string | null | undefined, fallback = "—") =>
  lookup(PRODUCT_TYPE_LABELS, v, fallback);

export const formatVerdict = (v: string | null | undefined, fallback = "—") =>
  lookup(VERDICT_LABELS, v, fallback);
