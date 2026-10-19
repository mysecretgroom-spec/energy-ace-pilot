// @vitest-environment node
import { describe, it, expect } from "vitest";
import { detectPaperRegion, paperLikelihood } from "./edgeDetectionLight";
import { validScanCorners } from "./scanQuality";

describe("page detection rather than surrounding furniture", () => {
  it("excludes a brighter wooden desk around a smaller neutral sheet", () => {
    const w = 240, h = 320, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const paper = x >= 80 && x < 160 && y >= 85 && y < 235;
      const ink = paper && y > 100 && y < 220 && y % 14 < 2 && x > 90 && x < 150;
      rgba.set(ink ? [50, 55, 52, 255] : paper ? [185, 201, 194, 255] : [230, 205, 130, 255], (y * w + x) * 4);
    }
    const result = detectPaperRegion(paperLikelihood(rgba), w, h);
    if (!result) throw new Error("Sheet not found on the desk");
    expect(result.topLeft.x).toBeCloseTo(80 / w, 1);
    expect(result.topLeft.y).toBeCloseTo(85 / h, 1);
    expect(result.bottomRight.x).toBeCloseTo(159 / w, 1);
    expect(result.bottomRight.y).toBeCloseTo(234 / h, 1);
  });
  it("finds a small shaded page covering less than 20% of the photo", () => {
    const w = 240, h = 320, gray = new Uint8Array(w*h).fill(20);
    for (let y=95; y<225; y++) for (let x=90; x<155; x++) gray[y*w+x] = x<120 ? 130 : 205;
    // Printed lines, not a blank paper-only fixture.
    for (let y=105; y<215; y+=10) for (let x=98; x<146; x++) gray[y*w+x] = 35;
    const result = detectPaperRegion(gray,w,h);
    expect(result).not.toBeNull();
    if (!result) throw new Error("Page not found");
    expect(validScanCorners(result)).toBe(true);
    expect(result.topLeft.x).toBeCloseTo(90/w,1);
    expect(result.topLeft.y).toBeCloseTo(95/h,1);
    expect(result.bottomRight.x).toBeCloseTo(154/w,1);
    expect(result.bottomRight.y).toBeCloseTo(224/h,1);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
  it("keeps a long receipt that runs past the bottom of the photo", () => {
    const w = 240, h = 320, gray = new Uint8Array(w*h).fill(25);
    for (let y=60; y<h; y++) for (let x=70; x<170; x++) gray[y*w+x] = 215;
    for (let y=80; y<h-10; y+=12) for (let x=80; x<160; x++) gray[y*w+x] = 40;
    const result = detectPaperRegion(gray,w,h);
    if (!result) throw new Error("Receipt not found");
    expect(result.topLeft.x).toBeCloseTo(70/w,1);
    expect(result.topLeft.y).toBeCloseTo(60/h,1);
    expect(result.topRight.x).toBeCloseTo(169/w,1);
    expect(result.bottomLeft.y).toBeGreaterThan(0.97);
  });
  it("does not invent a page on an evenly dark scene", () => {
    expect(detectPaperRegion(new Uint8Array(120*160).fill(20),120,160)).toBeNull();
  });
  it("rejects a bright frame-connected background", () => {
    expect(detectPaperRegion(new Uint8Array(120*160).fill(220),120,160)).toBeNull();
  });
});