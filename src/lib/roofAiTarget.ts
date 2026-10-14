import { DEFAULT_ROOF_MAP_ZOOM, type RoofMapViewport } from "./roofMapViewport";

function worldPixel(latitude: number, longitude: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const radians = latitude * Math.PI / 180;
  return {
    x: (longitude + 180) / 360 * size,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * size,
  };
}

/** Position of the selected point in the unchanged map framing, not its centre. */
export function roofAiTarget(latitude: number, longitude: number, viewport?: RoofMapViewport) {
  const zoom = viewport?.zoom ?? DEFAULT_ROOF_MAP_ZOOM;
  const point = worldPixel(latitude, longitude, zoom);
  const center = worldPixel(viewport?.centerLatitude ?? latitude, viewport?.centerLongitude ?? longitude, zoom);
  return {
    x: 0.5 + (point.x - center.x) / (viewport?.width ?? 360),
    y: 0.5 + (point.y - center.y) / (viewport?.height ?? 224),
  };
}

export function isRoofAiTargetVisible(target: { x: number; y: number }) {
  return Number.isFinite(target.x) && Number.isFinite(target.y) && target.x >= 0 && target.x <= 1 && target.y >= 0 && target.y <= 1;
}

/** A close-up reference only: the output must retain the full map framing. */
export async function cropRoofAiTarget(source: string, target: { x: number; y: number }) {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Carte de référence illisible."));
    image.src = source;
  });
  const width = Math.min(image.naturalWidth, Math.max(160, image.naturalWidth * 0.45));
  const height = Math.min(image.naturalHeight, Math.max(160, image.naturalHeight * 0.6));
  const left = Math.max(0, Math.min(image.naturalWidth - width, target.x * image.naturalWidth - width / 2));
  const top = Math.max(0, Math.min(image.naturalHeight - height, target.y * image.naturalHeight - height / 2));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * 2);
  canvas.height = Math.round(height * 2);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Carte de référence indisponible.");
  context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}