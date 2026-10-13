export const PANEL_WIDTH_METRES = 1.13;
export const PANEL_HEIGHT_METRES = 2.095;
const EARTH_RADIUS = 6378137;

export interface RoofPanel {
  id: string;
  zoneId: string;
  latitude: number;
  longitude: number;
  rotation: number;
}
export interface RoofPanelZone {
  id: string;
  latitude: number;
  longitude: number;
}
export interface RoofPanelLayout {
  zones: RoofPanelZone[];
  panels: RoofPanel[];
}

/** Local tangent-plane metres: width/length are fixed, never stretched by drawing. */
export function panelCorners(panel: RoofPanel): [number, number][] {
  const angle = panel.rotation * Math.PI / 180;
  return [
    [-PANEL_WIDTH_METRES / 2, -PANEL_HEIGHT_METRES / 2],
    [PANEL_WIDTH_METRES / 2, -PANEL_HEIGHT_METRES / 2],
    [PANEL_WIDTH_METRES / 2, PANEL_HEIGHT_METRES / 2],
    [-PANEL_WIDTH_METRES / 2, PANEL_HEIGHT_METRES / 2],
  ].map(([east, north]) => {
    const x = east * Math.cos(angle) + north * Math.sin(angle);
    const y = north * Math.cos(angle) - east * Math.sin(angle);
    return [panel.latitude + y / EARTH_RADIUS * 180 / Math.PI,
      panel.longitude + x / (EARTH_RADIUS * Math.cos(panel.latitude * Math.PI / 180)) * 180 / Math.PI];
  });
}

export function parseRoofPanelLayout(value: unknown): RoofPanelLayout | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.zones) || !Array.isArray(raw.panels) || raw.zones.length > 200 || raw.panels.length > 200) return undefined;
  const validPoint = (v: unknown): v is RoofPanelZone => {
    if (!v || typeof v !== "object") return false;
    const p = v as Record<string, unknown>;
    return typeof p.id === "string" && typeof p.latitude === "number" && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 85 &&
      typeof p.longitude === "number" && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  };
  if (!raw.zones.every(validPoint)) return undefined;
  const zoneIds = new Set(raw.zones.map(z => z.id));
  if (!raw.panels.every(p => validPoint(p) && typeof p.zoneId === "string" && zoneIds.has(p.zoneId) && typeof p.rotation === "number" && Number.isFinite(p.rotation))) return undefined;
  return { zones: raw.zones, panels: raw.panels as RoofPanel[] };
}

export function addRoofPanel(layout: RoofPanelLayout, panel: RoofPanel, targetCount: number): RoofPanelLayout {
  if (layout.panels.length >= targetCount || !layout.zones.some(z => z.id === panel.zoneId)) return layout;
  return { ...layout, panels: [...layout.panels, panel] };
}