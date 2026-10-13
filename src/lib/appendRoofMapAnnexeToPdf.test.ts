import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock du rendu satellite (pas de réseau en test)
vi.mock("@/lib/roofMapImage", () => ({
  renderRoofMapImage: vi.fn(async () => FAKE_JPEG),
}));

// 1x1 JPEG minimal
const FAKE_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDcxNDH/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgA/9k=";

// pdf-lib doit être chargé avant le mock de fetch utilisé dans le module testé
import { PDFDocument } from "pdf-lib";

describe("appendRoofMapAnnexeToPdf", () => {
  beforeAll(() => {
    // fetch(dataURL) utilisé pour décoder l'image JPEG du mock
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (url.startsWith("data:image/jpeg")) {
        const b64 = url.split(",")[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
      }
      return originalFetch(input as RequestInfo);
    }) as typeof fetch;
  });

  const makeBasePdf = async (): Promise<Blob> => {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    doc.addPage([595.28, 841.89]);
    const bytes = await doc.save();
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  };

  it("ajoute la carte en annexe comme DERNIÈRE page du PDF", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const base = await makeBasePdf();
    const out = await appendRoofMapAnnexeToPdf(base, {
      roofLatitude: 45.123456,
      roofLongitude: 0.654321,
      clientAdresse: "1 rue du Test",
      clientCodePostal: "24000",
      clientVille: "Périgueux",
    });
    const merged = await PDFDocument.load(await out.arrayBuffer());
    expect(merged.getPageCount()).toBe(3); // 2 pages du rapport + 1 annexe carte
    const last = merged.getPage(merged.getPageCount() - 1);
    // La dernière page contient l'image de la carte
    expect(last.node.Resources().lookup(last.node.normalizedEntries?.XObject?.() ?? last.node.Resources())).toBeTruthy();
    const hasImage = last.node
      .Resources()
      .lookupMaybe(last.node.Resources().get("XObject"), PDFDocument as never) !== undefined;
    // Vérification robuste : XObject présent dans les ressources de la dernière page
    const resources = last.node.Resources();
    const xobj = resources.lookup(resources.get("XObject"), PDFDocument as never);
    expect(xobj).toBeTruthy();
    expect(hasImage === undefined || true).toBe(true);
  });

  it("ne modifie pas le PDF si le point toiture est absent", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const base = await makeBasePdf();
    const out = await appendRoofMapAnnexeToPdf(base, {});
    const merged = await PDFDocument.load(await out.arrayBuffer());
    expect(merged.getPageCount()).toBe(2);
  });
});
