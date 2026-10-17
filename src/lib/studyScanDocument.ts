export const STUDY_SCAN_SOURCE = "study_scan";

export function studyScanAssociation(etudeId?: string) {
  return etudeId ? { etude_id: etudeId, context_source: STUDY_SCAN_SOURCE } : {};
}