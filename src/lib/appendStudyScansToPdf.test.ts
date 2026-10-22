// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendStudyScansToPdf } from "./appendStudyScansToPdf";
import { studyScanAssociation } from "./studyScanDocument";

const state = vi.hoisted(() => ({ data: [] as { id: string; nom: string; url: string }[], error: null as unknown, filters: [] as unknown[][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const q = { select: () => q, eq: (...args: unknown[]) => { state.filters.push(args); return q; },
    order: () => q, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: state.data, error: state.error }).then(resolve) };
  return q;
} } }));
async function pdf(width: number, count = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([width, 842]);
  return new Blob([await doc.save() as unknown as BlobPart], { type: "application/pdf" });
}
beforeEach(() => { state.data = []; state.error = null; state.filters = []; vi.unstubAllGlobals(); });
describe("study scan annexes", () => {
  it("stores scans on the explicit study, separate from normal client documents", () => {
    expect(studyScanAssociation("study-1")).toEqual({ etude_id: "study-1", context_source: "study_scan" });
    expect(studyScanAssociation()).toEqual({});
  });
  it("adds every scan page after the study in the report's uniform format", async () => {
    state.data = [{ id: "scan-1", nom: "RIB", url: "https://example.test/scan.pdf" }];
    const scan = await pdf(420, 2);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(scan)));
    const result = await appendStudyScansToPdf(await pdf(595), "user-1", "client-1", "study-1");
    const merged = await PDFDocument.load(await result.arrayBuffer());
    expect(merged.getPages().map(p => p.getWidth())).toEqual([595, 595, 595]);
    expect(state.filters).toEqual([["user_id", "user-1"], ["client_id", "client-1"], ["etude_id", "study-1"], ["context_source", "study_scan"]]);
  });
  it("keeps a study without scans unchanged", async () => {
    const original = await pdf(595);
    expect(await appendStudyScansToPdf(original, "u", "c", "e")).toBe(original);
  });
  it("blocks incomplete sharing when a saved scan cannot be read", async () => {
    state.data = [{ id: "s", nom: "RIB", url: "https://example.test/scan.pdf" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    await expect(appendStudyScansToPdf(await pdf(595), "u", "c", "e")).rejects.toThrow("RIB");
  });
  it("does not silently treat a failed query as no scans", async () => {
    state.error = new Error("offline");
    await expect(appendStudyScansToPdf(await pdf(595), "u", "c", "e")).rejects.toThrow("charger");
  });
});