import { describe, it, expect } from "vitest";
import { PLANS, yearlySavings, priceIdFor, tierOfPriceId, TOPUPS } from "./plans";

describe("plans", () => {
  it("Classique costs 49,99 € per month", () => expect(PLANS.classique.monthly).toBe(49.99));
  it("Premium costs 89,99 € per month", () => expect(PLANS.premium.monthly).toBe(89.99));
  it("annual billing gives 2 months free", () => {
    expect(yearlySavings("classique")).toBe(99.98);
    expect(yearlySavings("premium")).toBe(179.98);
  });
  it("AI quota is 10 € Classique / 15 € Premium", () => {
    expect(PLANS.classique.aiBudgetEur).toBe(10);
    expect(PLANS.premium.aiBudgetEur).toBe(15);
  });
  it("top-ups are 5 / 20 / 50 €", () => expect(TOPUPS.map((t) => t.amount)).toEqual([5, 20, 50]));
  it("maps price ids to tiers", () => {
    expect(priceIdFor("premium", "yearly")).toBe("premium_yearly");
    expect(tierOfPriceId("classique_monthly")).toBe("classique");
  });
});
