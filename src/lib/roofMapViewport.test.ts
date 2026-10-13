import { describe, expect, it } from "vitest";
import { parseRoofMapViewport, roofMapRenderGeometry } from "./roofMapViewport";

describe("roof map export extent", () => {
  const viewport = { centerLatitude: 44.847928, centerLongitude: -0.572644, zoom: 19, width: 360, height: 224 };

  it("preserves the study extent rather than expanding it to 1024 pixels", () => {
    const geometry = roofMapRenderGeometry(viewport);
    expect(geometry.sourceWidth).toBe(360);
    expect(geometry.sourceHeight).toBe(224);
    expect(geometry.width).toBe(720);
    expect(geometry.height).toBe(448);
    expect(geometry.tileScale).toBe(2);
  });

  it("preserves zoom 20 using native zoom 19 tiles", () => {
    const geometry = roofMapRenderGeometry({ ...viewport, zoom: 20 });
    expect(geometry.tileZoom).toBe(19);
    expect(geometry.sourceWidth).toBe(180);
    expect(geometry.tileScale).toBe(4);
  });

  it("restores the saved viewport and rejects invalid dimensions", () => {
    expect(parseRoofMapViewport(viewport)).toEqual(viewport);
    expect(parseRoofMapViewport({ ...viewport, width: 0 })).toBeUndefined();
    expect(parseRoofMapViewport({ ...viewport, zoom: NaN })).toBeUndefined();
  });
});