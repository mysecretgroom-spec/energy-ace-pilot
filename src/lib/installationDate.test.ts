import { describe, it, expect } from "vitest";
import { resolveInstallationRealDate } from "./installationDate";

const TODAY = "2026-05-04";

describe("resolveInstallationRealDate", () => {
  it("returns null when date_installation_reelle is already set (never overwrite)", () => {
    expect(resolveInstallationRealDate("2026-04-29", "2026-05-05", TODAY)).toBeNull();
    expect(resolveInstallationRealDate("2026-04-29", null, TODAY)).toBeNull();
    expect(resolveInstallationRealDate("2026-04-29", undefined, TODAY)).toBeNull();
  });

  it("preserves a future planned date instead of forcing today", () => {
    expect(resolveInstallationRealDate(null, "2026-05-05", TODAY)).toBe("2026-05-05");
    expect(resolveInstallationRealDate(undefined, "2027-01-01", TODAY)).toBe("2027-01-01");
  });

  it("falls back to today when no planned date exists", () => {
    expect(resolveInstallationRealDate(null, null, TODAY)).toBe(TODAY);
    expect(resolveInstallationRealDate(null, undefined, TODAY)).toBe(TODAY);
    expect(resolveInstallationRealDate(undefined, "", TODAY)).toBe(TODAY);
  });

  it("uses today when planned date is in the past or today", () => {
    expect(resolveInstallationRealDate(null, "2026-05-04", TODAY)).toBe(TODAY);
    expect(resolveInstallationRealDate(null, "2026-04-01", TODAY)).toBe(TODAY);
  });

  it("uses real today by default when no override provided", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(resolveInstallationRealDate(null, null)).toBe(today);
  });
});
