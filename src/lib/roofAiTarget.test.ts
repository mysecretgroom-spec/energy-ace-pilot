import { describe, expect, it } from "vitest";
import { isRoofAiTargetVisible, roofAiTarget } from "./roofAiTarget";

describe("Selected red point for PV imagery", () => {
  it("targets the selected point, not a different roof at the map centre", () => {
    const target = roofAiTarget(45.221749, 0.835035, {
      centerLatitude: 45.221749, centerLongitude: 0.8348, zoom: 19, width: 360, height: 224,
    });
    expect(target.x).toBeCloseTo(0.5 + (0.835035 - 0.8348) / 360 * (256 * 2 ** 19) / 360, 8);
    expect(target.y).toBe(0.5);
  });
  it("keeps the same target at higher image pixel density", () => {
    expect(roofAiTarget(45.221749, 0.835035)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("rejects a point outside the saved frame instead of choosing another roof", () => {
    expect(isRoofAiTargetVisible(roofAiTarget(45.221749, 0.845035, {
      centerLatitude: 45.221749, centerLongitude: 0.835035, zoom: 19, width: 360, height: 224,
    }))).toBe(false);
    expect(isRoofAiTargetVisible({ x: NaN, y: 0.5 })).toBe(false);
  });
});