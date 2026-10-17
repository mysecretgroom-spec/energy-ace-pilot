// @vitest-environment node
import { describe, it, expect } from "vitest";
import { detectPaperRegion } from "./edgeDetectionLight";
import { validScanCorners } from "./scanQuality";

describe("page detection rather than surrounding furniture", () => {
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
  it("does not invent a page on an evenly dark scene", () => {
    expect(detectPaperRegion(new Uint8Array(120*160).fill(20),120,160)).toBeNull();
  });
  it("rejects a bright frame-connected background", () => {
    expect(detectPaperRegion(new Uint8Array(120*160).fill(220),120,160)).toBeNull();
  });
});