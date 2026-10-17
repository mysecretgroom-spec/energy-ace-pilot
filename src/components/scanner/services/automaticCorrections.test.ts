// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deskewBounds, documentContrast, estimateDocumentSkew } from "./automaticCorrections";

function textLines(width: number, height: number, angle: number) {
  const gray = new Uint8Array(width * height).fill(230);
  const slope = Math.tan(angle * Math.PI / 180);
  for (let line = 30; line < height - 30; line += 24) {
    for (let x = 25; x < width - 25; x++) {
      if (x % 12 > 7) continue;
      const y = Math.round(line + (x - width / 2) * slope);
      for (let dy = 0; dy < 3; dy++) if (y + dy >= 0 && y + dy < height) gray[(y + dy) * width + x] = 50;
    }
  }
  return gray;
}

describe("automatic document deskew", () => {
  for (const [width, height] of [[240, 360], [360, 240]]) {
    for (const angle of [-6, 0, 4]) {
      it(`estimates ${angle} degree text on ${width}x${height} pages`, () => {
        expect(estimateDocumentSkew(textLines(width, height, angle), width, height)).toBeCloseTo(angle, 0);
      });
    }
  }
  it("leaves blank, dark, uniform and sparse pages unrotated", () => {
    for (const value of [0, 120, 255]) expect(estimateDocumentSkew(new Uint8Array(240 * 360).fill(value), 240, 360)).toBe(0);
    const sparse = new Uint8Array(240 * 360).fill(255);
    sparse[120] = 0;
    expect(estimateDocumentSkew(sparse, 240, 360)).toBe(0);
  });
  it("rejects text at the search boundary", () => {
    expect(estimateDocumentSkew(textLines(240, 360, 12), 240, 360)).toBe(0);
  });
  it("expands rotation bounds so all four document corners fit", () => {
    const bounds = deskewBounds(800, 1200, 6);
    const r = 6 * Math.PI / 180;
    for (const x of [-400, 400]) for (const y of [-600, 600]) {
      expect(Math.abs(x * Math.cos(r) - y * Math.sin(r))).toBeLessThanOrEqual(bounds.width / 2);
      expect(Math.abs(x * Math.sin(r) + y * Math.cos(r))).toBeLessThanOrEqual(bounds.height / 2);
    }
  });
});

describe("bounded automatic contrast", () => {
  it("increases faint text/paper separation without darkening paper", () => {
    const pixels = new Uint8ClampedArray([120, 120, 120, 255, 210, 210, 210, 255]);
    const corrected = documentContrast(pixels);
    expect(corrected[4] - corrected[0]).toBeGreaterThan(90);
    expect(corrected[4]).toBeGreaterThanOrEqual(210);
    expect(corrected[3]).toBe(255);
    expect(pixels[0]).toBe(120);
  });
  it("preserves blank pages and alpha", () => {
    const pixels = new Uint8ClampedArray([230, 230, 230, 127, 230, 230, 230, 0]);
    expect(documentContrast(pixels)).toEqual(pixels);
  });
});