import { describe, it, expect } from "vitest";
import { isInstallationDone, isInstallationHidden } from "./installationStatus";

describe("décompte des poses", () => {
  it("compte seulement si la vente est passée en posé", () => {
    expect(isInstallationDone("nouveau", "envoi_pose")).toBe(false);
    expect(isInstallationDone("nouveau", "installe")).toBe(true);
  });
  it("masque une pose rétractée, annulée ou reportée", () => {
    expect(isInstallationHidden("nouveau", "retracte")).toBe(true);
    expect(isInstallationHidden("nouveau", "annule")).toBe(true);
    expect(isInstallationHidden("reporte", "envoi_pose")).toBe(true);
    expect(isInstallationDone("reporte", "installe")).toBe(false);
  });
});
