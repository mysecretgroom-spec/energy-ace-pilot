import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendPagesUniform, fitIntoPage, ANNEX_MARGIN_PT } from "./normalizePdfPages";

const A4 = { width: 595.28, height: 841.89 };

describe("uniform study PDF pages", () => {
  it("every appended page takes the report page size", async () => {
    const report = await PDFDocument.create(); report.addPage([A4.width, A4.height]);
    const scan = await PDFDocument.create(); scan.addPage([1200, 1800]); scan.addPage([800, 500]);
    await appendPagesUniform(report, scan);
    expect(report.getPageCount()).toBe(3);
    for (const p of report.getPages()) {
      expect(p.getWidth()).toBeCloseTo(A4.width);
      expect(p.getHeight()).toBeCloseTo(A4.height);
    }
  });
  it("a portrait scan fills the full page width minus the margin", () => {
    const box = fitIntoPage({ width: 1000, height: 1300 }, A4);
    expect(box.width).toBeCloseTo(A4.width - 2 * ANNEX_MARGIN_PT);
  });
  it("a tall scan is limited by height and never overflows", () => {
    const box = fitIntoPage({ width: 500, height: 2000 }, A4);
    expect(box.height).toBeCloseTo(A4.height - 2 * ANNEX_MARGIN_PT);
    expect(box.width).toBeLessThan(A4.width);
  });
});
