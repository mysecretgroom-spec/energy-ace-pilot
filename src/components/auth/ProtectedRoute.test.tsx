// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const access = vi.hoisted(() => ({ isLoading: false, error: null as Error | null, retry: vi.fn(), isPaywall: false, isBlocked: false, isInTrial: false, daysLeftInTrial: 0 }));
const state = vi.hoisted(() => ({ timedOut: false }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: () => [state.timedOut, vi.fn()] }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user" }, loading: false }) }));
vi.mock("@/hooks/useSaasAccess", () => ({ useSaasAccess: () => access }));
vi.mock("@/components/saas/PaywallScreen", () => ({ PaywallScreen: () => <div data-testid="paywall" /> }));
vi.mock("@/components/saas/TrialBanner", () => ({ TrialBanner: () => null }));

const open = () => renderToStaticMarkup(<MemoryRouter><ProtectedRoute><div data-testid="protected-content" /></ProtectedRoute></MemoryRouter>);

afterEach(() => { state.timedOut = false; access.isLoading = false; access.error = null; access.isBlocked = false; });

describe("Access-check recovery", () => {
  it("does not expose protected content on a failed access check", () => {
    access.error = new Error("unavailable");
    const html = open();
    expect(html).not.toContain('data-testid="protected-content"');
    expect(html).toContain('role="alert"');
  });
  it("does not bypass the check after the existing five-second timeout", () => {
    state.timedOut = true;
    access.isLoading = true;
    const html = open();
    expect(html).not.toContain('data-testid="protected-content"');
    expect(html).toContain('role="alert"');
  });
  it("still blocks an account when verification succeeds with blocked status", () => {
    access.isBlocked = true;
    const html = open();
    expect(html).toContain('data-testid="paywall"');
    expect(html).not.toContain('data-testid="protected-content"');
  });
  it("shows content once the check succeeds", () => {
    expect(open()).toContain('data-testid="protected-content"');
  });
});