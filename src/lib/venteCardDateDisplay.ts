import type { VenteStatus } from "./venteStatusConfig";

export type VenteDateDisplay =
  | { kind: "install"; label: "Posé" | "Pose"; date: string }
  | { kind: "signature"; date: string }
  | null;

const INSTALL_VISIBLE_STATUSES: VenteStatus[] = [
  "envoi_pose",
  "en_installation",
  "installe",
  "attente_paiement",
  "paye",
];

/**
 * Pure logic deciding which date a Vente card should display:
 * - For statuses from `envoi_pose` onwards: show installation date
 *   (real if available, otherwise planned), prefixed with "Posé" / "Pose".
 * - Otherwise: fall back to the signature date.
 */
export function getVenteCardDateDisplay(vente: {
  status: VenteStatus | string;
  date_signature: string | null | undefined;
  date_installation_reelle?: string | null;
  date_installation_prevue?: string | null;
}): VenteDateDisplay {
  const installDate = vente.date_installation_reelle || vente.date_installation_prevue;
  const showInstall =
    !!installDate &&
    INSTALL_VISIBLE_STATUSES.includes(vente.status as VenteStatus);

  if (showInstall && installDate) {
    return {
      kind: "install",
      label: vente.date_installation_reelle ? "Posé" : "Pose",
      date: installDate,
    };
  }

  return vente.date_signature
    ? { kind: "signature", date: vente.date_signature }
    : null;
}
