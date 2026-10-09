// @vitest-environment node
import { describe, expect, it } from "vitest";
import { studyRecapDetails } from "./regieRecap";

describe("agency study recap values", () => {
  it("reports annual consumption in kWh without converting it to production", () => {
    expect(studyRecapDetails({ consoAnnuelle: 8500, productionAnnuelle: 9000 }).consommationKwh).toBe(8500);
  });
  it("reports the electricity bill annually alongside annual kWh", () => {
    expect(studyRecapDetails({ factureMensuelle: 150 }).factureAnnuelleEuros).toBe(1800);
  });
  it("uses the recommended power", () => {
    expect(studyRecapDetails({ puissanceKwc: 6 }).puissanceKwc).toBe(6);
  });
  it("reports the full price before aids, not the remaining amount", () => {
    expect(studyRecapDetails({ prixTotalHorsAides: 26900, totalAidesDeduites: 24000 }).prixTTC).toBe(26900);
  });
  it("uses the study credit payment, including zero for cash payment", () => {
    expect(studyRecapDetails({ mensualite: 230.78 }).mensualiteCredit).toBe(230.78);
    expect(studyRecapDetails({ mensualite: 0 }).mensualiteCredit).toBe(0);
  });
});