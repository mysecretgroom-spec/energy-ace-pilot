export const PV_INSTALLATIONS = [
  { value: "toiture", label: "Toiture" },
  { value: "pergola", label: "Pergola" },
  { value: "carport_bois", label: "Carport bois" },
  { value: "carport_alu", label: "Carport aluminium" },
  { value: "bac_leste", label: "Bacs lestés (GSE)" },
] as const;

export type PvInstallationType = typeof PV_INSTALLATIONS[number]["value"];

export function pvPlacementPayload(installationType: PvInstallationType, surfaceConstraint: string, referenceMapBase64: string) {
  return { installationType, surfaceConstraint: surfaceConstraint.trim(), referenceMapBase64 };
}