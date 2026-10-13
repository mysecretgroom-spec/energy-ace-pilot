import { parseRoofPanelLayout, type RoofPanelLayout } from "./roofPanelLayout";

export interface RoofMapViewport {
  centerLatitude: number;
  centerLongitude: number;
  zoom: number;
  width: number;
  height: number;
  panelLayout?: RoofPanelLayout;
}

export const DEFAULT_ROOF_MAP_ZOOM = 19;

export function parseRoofMapViewport(value: unknown): RoofMapViewport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const keys = ["centerLatitude", "centerLongitude", "zoom", "width", "height"];
  if (!keys.every(key => typeof v[key] === "number" && Number.isFinite(v[key]))) return undefined;
  const viewport = v as unknown as RoofMapViewport;
  if (Math.abs(viewport.centerLatitude) > 85 || Math.abs(viewport.centerLongitude) > 180 ||
      viewport.zoom < 1 || viewport.zoom > 20 || viewport.width <= 0 || viewport.height <= 0 ||
      viewport.width > 10000 || viewport.height > 10000) return undefined;
  return { ...viewport, ...(v.panelLayout ? { panelLayout: parseRoofPanelLayout(v.panelLayout) } : {}) };
}

export function roofMapRenderGeometry(viewport: RoofMapViewport, pixelRatio = 2) {
  const tileZoom = Math.min(19, viewport.zoom);
  const tileScale = 2 ** (viewport.zoom - tileZoom) * pixelRatio;
  return {
    width: Math.round(viewport.width * pixelRatio),
    height: Math.round(viewport.height * pixelRatio),
    tileZoom,
    tileScale,
    sourceWidth: viewport.width / 2 ** (viewport.zoom - tileZoom),
    sourceHeight: viewport.height / 2 ** (viewport.zoom - tileZoom),
  };
}