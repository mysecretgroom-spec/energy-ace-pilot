// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addRoofPanel, panelCorners, parseRoofPanelLayout } from "./roofPanelLayout";

const panel = { id: "p1", zoneId: "z1", latitude: 45, longitude: 1, rotation: 0 };
const layout = { zones: [{ id: "z1", latitude: 45, longitude: 1 }], panels: [panel] };
const distance = (a: number[], b: number[]) => {
  const rad = Math.PI / 180;
  return Math.hypot((b[0] - a[0]) * rad * 6378137, (b[1] - a[1]) * rad * 6378137 * Math.cos(45 * rad));
};
describe("Placement manuel PV", () => {
  it("respecte les dimensions 1130 × 2095 mm", () => {
    const corners = panelCorners(panel);
    expect(distance(corners[0], corners[1])).toBeCloseTo(1.13, 6);
    expect(distance(corners[1], corners[2])).toBeCloseTo(2.095, 6);
  });
  it("conserve les dimensions après rotation", () => {
    const corners = panelCorners({ ...panel, rotation: 37 });
    expect(distance(corners[0], corners[1])).toBeCloseTo(1.13, 6);
    expect(distance(corners[1], corners[2])).toBeCloseTo(2.095, 6);
  });
  it("ne dépasse pas les 12 panneaux d’une étude 6 kWc", () => {
    const full = { ...layout, panels: Array.from({ length: 12 }, (_, i) => ({ ...panel, id: String(i) })) };
    expect(addRoofPanel(full, { ...panel, id: "extra" }, 12).panels).toHaveLength(12);
  });
  it("restaure les panneaux et leur zone enregistrée", () => {
    expect(parseRoofPanelLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
    expect(parseRoofPanelLayout({ ...layout, panels: [{ ...panel, zoneId: "inconnue" }] })).toBeUndefined();
  });
});