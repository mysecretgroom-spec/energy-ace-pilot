import { describe, expect, it } from "vitest";
import { satellitePanelGrid } from "./satellitePanelOverlay";

describe("satellitePanelGrid", () => {
  it("draws exactly the requested 7 panels", () => {
    expect(satellitePanelGrid(7, { w: 6, h: 11 }, { x: 100, y: 100 })).toHaveLength(7);
  });
  it("centres the layout on the designated point", () => {
    const rects = satellitePanelGrid(4, { w: 6, h: 11 }, { x: 100, y: 80 });
    const minX = Math.min(...rects.map((r) => r.x)), maxX = Math.max(...rects.map((r) => r.x + r.w));
    const minY = Math.min(...rects.map((r) => r.y)), maxY = Math.max(...rects.map((r) => r.y + r.h));
    expect((minX + maxX) / 2).toBeCloseTo(100);
    expect((minY + maxY) / 2).toBeCloseTo(80);
  });
});
