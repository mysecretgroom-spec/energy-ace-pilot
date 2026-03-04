/**
 * Configuration centralisée des statuts de vente
 * Tous les composants CRM doivent utiliser ces constantes
 */

export type VenteStatus =
  | 'en_negociation'
  | 'signe'
  | 'cq_a_faire'
  | 'cq_fait'
  | 'attente_financement'
  | 'envoi_pose'
  | 'en_installation'
  | 'installe'
  | 'attente_paiement'
  | 'paye'
  | 'annule'
  | 'refus_financement'
  | 'inFinancable'
  | 'retracte'
  | 'refus_mairie_abf';

/** Statuts considérés comme des annulations */
export const CANCELLATION_STATUSES: VenteStatus[] = [
  'annule',
  'refus_financement',
  'inFinancable',
  'retracte',
  'refus_mairie_abf',
];

/** Vérifie si un statut est une annulation */
export function isCancellationStatus(status: string): boolean {
  return CANCELLATION_STATUSES.includes(status as VenteStatus);
}

/** Labels pour l'affichage */
export const VENTE_STATUS_LABELS: Record<VenteStatus, string> = {
  en_negociation: "En négociation",
  signe: "Signé",
  cq_a_faire: "CQ à faire",
  cq_fait: "CQ fait",
  attente_financement: "Attente financement",
  envoi_pose: "Envoi en pose",
  en_installation: "En installation",
  installe: "Posé",
  attente_paiement: "Attente paiement",
  paye: "Payé",
  annule: "Annulé",
  refus_financement: "Refus financement",
  inFinancable: "Infinançable",
  retracte: "Rétracté",
  refus_mairie_abf: "Refus Mairie / ABF",
};

/** Couleurs CSS par statut */
export const VENTE_STATUS_COLORS: Record<VenteStatus, string> = {
  en_negociation: "bg-amber-500/10 text-amber-600 border-amber-200",
  signe: "bg-blue-500/10 text-blue-600 border-blue-200",
  cq_a_faire: "bg-orange-500/10 text-orange-600 border-orange-200",
  cq_fait: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  attente_financement: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  envoi_pose: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  en_installation: "bg-purple-500/10 text-purple-600 border-purple-200",
  installe: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  attente_paiement: "bg-pink-500/10 text-pink-600 border-pink-200",
  paye: "bg-green-500/10 text-green-600 border-green-200",
  annule: "bg-red-500/10 text-red-600 border-red-200",
  refus_financement: "bg-red-500/10 text-red-600 border-red-200",
  inFinancable: "bg-red-500/10 text-red-600 border-red-200",
  retracte: "bg-red-500/10 text-red-600 border-red-200",
  refus_mairie_abf: "bg-red-500/10 text-red-600 border-red-200",
};

/** Mapping statut vente → classification WhatsApp */
export const VENTE_STATUS_TO_WHATSAPP: Record<VenteStatus, string | null> = {
  en_negociation: null,
  signe: "positif",
  cq_a_faire: null,
  cq_fait: null,
  attente_financement: null,
  envoi_pose: null,
  en_installation: null,
  installe: "installe",
  attente_paiement: null,
  paye: "paye",
  annule: "annule",
  refus_financement: "annule",
  inFinancable: "annule",
  retracte: "annule",
  refus_mairie_abf: "annule",
};

/** Mapping statut vente → colonne kanban */
export const VENTE_STATUS_TO_KANBAN_COLUMN: Record<VenteStatus, string> = {
  en_negociation: "en_negociation",
  signe: "signe",
  cq_a_faire: "admin",
  cq_fait: "admin",
  attente_financement: "admin",
  envoi_pose: "admin",
  en_installation: "installation",
  installe: "installation",
  attente_paiement: "attente_paiement",
  paye: "paye",
  annule: "annule",
  refus_financement: "annule",
  inFinancable: "annule",
  retracte: "annule",
  refus_mairie_abf: "annule",
};

/** Options pour les sélecteurs de statut */
export const VENTE_STATUS_OPTIONS: { value: VenteStatus; label: string }[] = [
  { value: "en_negociation", label: "En négociation" },
  { value: "signe", label: "Signé" },
  { value: "cq_a_faire", label: "CQ à faire" },
  { value: "cq_fait", label: "CQ fait" },
  { value: "attente_financement", label: "Att. financement" },
  { value: "envoi_pose", label: "Envoi pose" },
  { value: "en_installation", label: "En installation" },
  { value: "installe", label: "Posé" },
  { value: "attente_paiement", label: "Att. paiement" },
  { value: "paye", label: "Payé" },
  { value: "annule", label: "Annulé" },
  { value: "refus_financement", label: "Refus financement" },
  { value: "inFinancable", label: "Infinançable" },
  { value: "retracte", label: "Rétracté" },
  { value: "refus_mairie_abf", label: "Refus Mairie / ABF" },
];
