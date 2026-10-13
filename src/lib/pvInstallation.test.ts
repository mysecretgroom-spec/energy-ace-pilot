import { describe, expect, it } from "vitest";
import { pvPlacementPayload } from "./pvInstallation";

describe("Emplacement PV désigné", () => {
  it("conserve la toiture choisie et sa carte de référence", () => {
    expect(pvPlacementPayload("toiture", "  toit du garage  ", "data:image/jpeg;base64,map")).toEqual({ installationType: "toiture", surfaceConstraint: "toit du garage", referenceMapBase64: "data:image/jpeg;base64,map" });
  });
  it("ne transforme pas une pergola en toiture", () => {
    expect(pvPlacementPayload("pergola", "terrasse repérée", "map").installationType).toBe("pergola");
  });
  it("conserve le carport sur l’espace repéré", () => {
    expect(pvPlacementPayload("carport_bois", "stationnement", "map")).toEqual({ installationType: "carport_bois", surfaceConstraint: "stationnement", referenceMapBase64: "map" });
  });
});