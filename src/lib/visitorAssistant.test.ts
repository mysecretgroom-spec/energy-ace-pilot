import { describe, it, expect } from "vitest";
import { getVisitorAssistantReply } from "./visitorAssistant";

describe("visitor assistant", () => {
  it("always ends with the 10-day trial signup link", () => {
    for (const q of ["Mon planning de demain", "bonjour", "un frais"]) {
      const r = getVisitorAssistantReply(q);
      expect(r).toContain("10 jours d'essai gratuit");
      expect(r).toContain("(/essai-gratuit)");
    }
  });
  it("picks a topic answer", () => {
    expect(getVisitorAssistantReply("envoyer un ticket")).toContain("photo d'un ticket");
  });
});
