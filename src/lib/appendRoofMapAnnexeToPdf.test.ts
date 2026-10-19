// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from "vitest";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import type { EtudeData } from "@/lib/exportEtudePdf";
import { renderRoofMapImage } from "@/lib/roofMapImage";

// Mock du rendu satellite (pas de réseau en test)
const FAKE_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDcxNDH/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgA/9k=";

// 1x1 PNG (visuels IA)
const FAKE_PNG_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

vi.mock("@/lib/roofMapImage", () => ({
  renderRoofMapImage: vi.fn(async () => FAKE_JPEG),
}));

vi.mock("@/lib/roofAiVisuals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/roofAiVisuals")>();
  return {
    ...actual,
    fetchLatestAiVisuals: vi.fn(async () => ({
      satellite: FAKE_PNG_URL,
      photo: FAKE_PNG_URL,
      nbPanneaux: 6,
    })),
  };
});

const dataWithRoof = {
  roofLatitude: 45.123456,
  roofLongitude: 0.654321,
  clientAdresse: "1 rue du Test",
  clientCodePostal: "24000",
  clientVille: "Perigueux",
} as unknown as EtudeData;

const dataWithoutRoof = {} as unknown as EtudeData;

describe("appendRoofMapAnnexeToPdf", () => {
  beforeAll(() => {
    // fetch(dataURL) est utilisé pour décoder l'image JPEG du mock
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/png")) {
        const b64 = url.split(",")[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, { headers: { "Content-Type": url.slice(5, url.indexOf(";")) } });
      }
      return originalFetch(input as RequestInfo);
    }) as typeof fetch;
  });

  const makeBasePdf = async (pages = 2): Promise<Blob> => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([595.28, 841.89]);
    const bytes = await doc.save();
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  };

  it("ajoute la carte en annexe comme DERNIÈRE page du PDF", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const base = await makeBasePdf(2);
    const out = await appendRoofMapAnnexeToPdf(base, dataWithRoof);
    const merged = await PDFDocument.load(await out.arrayBuffer());
    expect(merged.getPageCount()).toBe(3); // 2 pages du rapport + 1 annexe carte

    // La dernière page porte la carte : ses ressources référencent une image XObject
    const last = merged.getPage(merged.getPageCount() - 1);
    const resources = last.node.Resources();
    const xobjDict = resources.get(PDFName.of("XObject")) as unknown as PDFDict;
    expect(xobjDict).toBeTruthy();
    const hasImage = xobjDict.entries().some(([, ref]) => {
      const stream = resources.context.lookup(ref) as unknown as
        | { dict?: { get?: (n: unknown) => unknown } }
        | undefined;
      return String(stream?.dict?.get?.(PDFName.of("Subtype"))) === "/Image";
    });
    expect(hasImage).toBe(true);
  });

  it("ne modifie pas le PDF si le point toiture est absent", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const base = await makeBasePdf(2);
    const out = await appendRoofMapAnnexeToPdf(base, dataWithoutRoof);
    const merged = await PDFDocument.load(await out.arrayBuffer());
    expect(merged.getPageCount()).toBe(2);
  });

  it("transmet le cadrage et le zoom enregistrés au rendu de l'annexe", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const viewport = { centerLatitude: 45.123, centerLongitude: 0.654, zoom: 20, width: 360, height: 224 };
    await appendRoofMapAnnexeToPdf(await makeBasePdf(), { ...dataWithRoof, roofMapViewport: viewport });
    expect(renderRoofMapImage).toHaveBeenLastCalledWith(45.123456, 0.654321, { viewport });
  });
  it("transmet les rectangles manuels au PDF sans changer leur géométrie", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const viewport = { centerLatitude: 45.123, centerLongitude: 0.654, zoom: 20, width: 360, height: 224,
      panelLayout: { zones: [{ id: "z1", latitude: 45.123, longitude: 0.654 }], panels: [{ id: "p1", zoneId: "z1", latitude: 45.123, longitude: 0.654, rotation: 27 }] } };
    const out = await appendRoofMapAnnexeToPdf(await makeBasePdf(), { ...dataWithRoof, roofMapViewport: viewport });
    expect(renderRoofMapImage).toHaveBeenLastCalledWith(45.123456, 0.654321, { viewport });
    expect((await PDFDocument.load(await out.arrayBuffer())).getPageCount()).toBe(3);
  });

  it("porte la mention IA sur les visuels générés par IA", async () => {
    const { appendRoofMapAnnexeToPdf } = await import("@/lib/appendRoofMapAnnexeToPdf");
    const out = await appendRoofMapAnnexeToPdf(await makeBasePdf(2), { ...dataWithRoos: undefined, etudeId: "etude-ia" } as unknown as EtudeData);
    const merged = await PDFDocument.load(await out.arrayBuffer());
    expect(merged.getPageCount()).toBe(3);

    // Les flux de contenu sont compressés : on les décompresse puis on décode le WinAnsi
    const raw = Buffer.from(await out.arrayBuffer());
    const latin = raw.toString("latin1");
    const texts: string[] = [];
    const re = /STREAM\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(latin))) {
      const start = m.index + m[0].length;
      const end = latin.indexOf("ENDSTREAM", start);
      if (end < 0) break;
      try {
        texts.push(zlib.inflateSync(Buffer.from(latin.slice(start, end), "latin1")).toString("latin1"));
      } catch { /* flux d'image : ignoré */ }
    }
    const content = texts.join("\n").replace(/\xE9/g, "é");
    expect(content).toContain("généré par IA");
    expect(content).toContain("Visuels générés par IA — rendus non contractuels.");
    expect(content).toContain("<4941>"); // badge « IA »
  });
});
