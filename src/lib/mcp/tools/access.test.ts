// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import listClients from "./list-clients";
import listAppointments from "./list-appointments";

const { factory, query } = vi.hoisted(() => {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { query, factory: vi.fn(() => ({ from: vi.fn(() => query) })) };
});
vi.mock("../supabase", () => ({ supabaseForUser: factory }));

describe("MCP caller boundaries", () => {
  beforeEach(() => vi.clearAllMocks());
  const ctx = { getUserId: () => "verified-caller", isAuthenticated: () => true, signal: new AbortController().signal };
  it("restricts clients to the verified caller", async () => {
    await listClients.handler({ limit: 20, offset: 0 }, ctx as Parameters<typeof listClients.handler>[1]);
    expect(query.eq).toHaveBeenCalledWith("user_id", "verified-caller");
  });
  it("restricts appointments to the verified caller", async () => {
    await listAppointments.handler({ start: "2026-10-21T00:00:00Z", end: "2026-10-22T00:00:00Z", limit: 20 }, ctx as Parameters<typeof listAppointments.handler>[1]);
    expect(query.eq).toHaveBeenCalledWith("user_id", "verified-caller");
  });
  it("refuses unauthenticated clients before reading data", async () => {
    const result = await listClients.handler({ limit: 20, offset: 0 }, { ...ctx, isAuthenticated: () => false } as Parameters<typeof listClients.handler>[1]);
    expect(result.isError).toBe(true);
    expect(factory).not.toHaveBeenCalled();
  });
});