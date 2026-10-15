/**
 * Règles de décompte des RDV de pose (type_rdv = 'installation').
 * - Une pose n'est comptée « réalisée » que si la vente liée est passée en Posé (ou au-delà).
 * - Une pose dont le RDV est annulé/reporté ou dont la vente est annulée/rétractée/refusée
 *   n'est plus affichée ni comptée.
 */
import { isCancellationStatus } from "@/lib/venteStatusConfig";

export const POSE_DONE_VENTE_STATUSES = ["installe", "attente_paiement", "paye"];
const HIDDEN_RDV_STATUSES = ["annule", "reporte"];

export function isInstallationHidden(rdvStatus?: string | null, venteStatus?: string | null): boolean {
  if (rdvStatus && HIDDEN_RDV_STATUSES.includes(rdvStatus)) return true;
  if (venteStatus && isCancellationStatus(venteStatus)) return true;
  return false;
}

export function isInstallationDone(rdvStatus?: string | null, venteStatus?: string | null): boolean {
  if (isInstallationHidden(rdvStatus, venteStatus)) return false;
  return !!venteStatus && POSE_DONE_VENTE_STATUSES.includes(venteStatus);
}
