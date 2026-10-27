// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getFraisWeekStart } from "./fraisWeek";

// Règle : le décompte hebdomadaire des frais court du samedi au vendredi.
describe("getFraisWeekStart", () => {
  const cases: Array<[string, string]> = [
    // (date quelconque, samedi attendu de sa semaine)
    ["2026-10-27", "2026-10-24"], // mardi → samedi précédent
    ["2026-10-31", "2026-10-31"], // samedi → lui-même
    ["2026-11-01", "2026-10-31"], // dimanche → samedi de la veille
    ["2026-11-06", "2026-10-31"], // vendredi → samedi précédent
    ["2026-02-08", "2026-02-07"], // dimanche → samedi précédent
  ];

  it.each(cases)("%s démarre la semaine de frais le %s", (input, expected) => {
    const [y, m, d] = input.split("-").map(Number);
    const start = getFraisWeekStart(new Date(y, m - 1, d));
    expect(start.toISOString().split("T")[0]).toBe(expected);
  });

  it("retourne toujours un samedi", () => {
    for (let i = 0; i < 7; i++) {
      const day = new Date(2026, 9, 26 + i); // 26/10/2026 = lundi
      expect(getFraisWeekStart(day).getDay()).toBe(6);
    }
  });
});
