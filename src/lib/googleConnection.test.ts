import { describe, expect, it } from "vitest";
import { UNIFIED_GOOGLE_SCOPES, googleReturnUri, googleServices, validGoogleState } from "../../supabase/functions/_shared/googleOAuthPolicy";

describe("Single Google authorization", () => {
  it("authorizes Gmail read and send in the shared consent", () => {
    expect(googleServices(UNIFIED_GOOGLE_SCOPES).gmail).toBe(true);
    expect(googleServices(UNIFIED_GOOGLE_SCOPES.filter(s => !s.endsWith("gmail.send"))).gmail).toBe(false);
  });
  it("authorizes Drive file uploads in the same consent", () => {
    expect(googleServices(UNIFIED_GOOGLE_SCOPES).drive).toBe(true);
    expect(googleServices(UNIFIED_GOOGLE_SCOPES.filter(s => !s.endsWith("drive.file"))).drive).toBe(false);
  });
  it("authorizes Agenda reads and events in the same consent", () => {
    expect(googleServices(UNIFIED_GOOGLE_SCOPES).calendar).toBe(true);
    expect(googleServices(UNIFIED_GOOGLE_SCOPES.filter(s => !s.endsWith("calendar.events"))).calendar).toBe(false);
  });
  it("binds consent to the authenticated user", () => {
    const row = { user_id: "user-a", expires_at: "2026-10-27T08:00:00Z" };
    expect(validGoogleState(row, "user-a", Date.parse("2026-10-27T07:55:00Z"))).toBe(true);
    expect(validGoogleState(row, "user-b", Date.parse("2026-10-27T07:55:00Z"))).toBe(false);
  });
  it("rejects expired or consumed consent", () => {
    expect(validGoogleState({ user_id: "a", expires_at: "2026-10-27T08:00:00Z" }, "a", Date.parse("2026-10-27T08:00:00Z"))).toBe(false);
    expect(validGoogleState(null, "a", Date.now())).toBe(false);
  });
  it("uses the explicit custom callback, never arbitrary origins", () => {
    expect(googleReturnUri("https://xn--dbalepro-b1a.app")).toBe("https://xn--dbalepro-b1a.app/oauth/google-drive/return");
    expect(() => googleReturnUri("https://attacker.example")).toThrow();
    expect(() => googleReturnUri("https://xn--dbalepro-b1a.app/other")).toThrow();
  });
});