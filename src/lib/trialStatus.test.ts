// @vitest-environment node
import { describe, it, expect } from "vitest";
import { trialStatus } from "./trialStatus";

const now = new Date("2026-10-26T12:00:00Z");

describe("trialStatus", () => {
  it("counts a paid subscription as converted even after the trial end", () => {
    expect(trialStatus({ converted: true, trial_ends_at: "2026-10-01T00:00:00Z" }, now)).toBe("converted");
  });
  it("is active before the end date", () => {
    expect(trialStatus({ converted: false, trial_ends_at: "2026-11-05T00:00:00Z" }, now)).toBe("active");
  });
  it("is expired after the end date without subscription", () => {
    expect(trialStatus({ converted: false, trial_ends_at: "2026-10-20T00:00:00Z" }, now)).toBe("expired");
  });
});
