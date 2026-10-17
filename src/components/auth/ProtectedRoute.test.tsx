import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

const access = vi.hoisted(() => ({ isLoading: false, error: null as Error | null, retry: vi.fn(), isPaywall: false, isBlocked: false, isInTrial: false, daysLeftInTrial: 0 }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user" }, loading: false }) }));
vi.mock("@/hooks/useSaasAccess", () => ({ useSaasAccess: () => access }));
vi.mock("@/components/saas/PaywallScreen", () => ({ PaywallScreen: () => <div data-testid="paywall" /> }));
vi.mock("@/components/saas/TrialBanner", () => ({ TrialBanner: () => null }));

const open = () => render(<MemoryRouter><ProtectedRoute><div data-testid="protected-content" /></ProtectedRoute></MemoryRouter>);

afterEach(() => { cleanup(); vi.useRealTimers(); access.isLoading = false; access.error = null; access.isBlocked = false; });

describe("Access-check recovery", () => {
  it("does not expose protected content on a failed access check", () => {
    access.error = new Error("unavailable");
    open();
    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
  it("does not bypass the check after the existing five-second timeout", () => {
    vi.useFakeTimers();
    access.isLoading = true;
    open();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("still blocks an account when verification succeeds with blocked status", () => {
    access.isBlocked = true;
    open();
    expect(screen.getByTestId("paywall")).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
  it("shows content once the check succeeds", () => {
    open();
    expect(screen.getByTestId("protected-content")).toBeTruthy();
  });
});