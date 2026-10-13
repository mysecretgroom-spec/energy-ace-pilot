/** Fond satellite sans clé ni logo Google (Esri World Imagery). */
export const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const TILE = 256;

function lonLatToPixel(lon: number, lat: number, z: number) {
  const n = TILE * 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = SATELLITE_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  });
}

/** Image JPEG (dataURL) de la vue satellite centrée sur le point toiture, avec repère. */
export async function renderRoofMapImage(
  lat: number,
  lng: number,
  opts: { width?: number; height?: number; zoom?: number } = {}
): Promise<string | null> {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 640;
  const z = opts.zoom ?? 19;
  try {
    const c = lonLatToPixel(lng, lat, z);
    const left = c.x - width / 2;
    const top = c.y - height / 2;
    const tx0 = Math.floor(left / TILE), tx1 = Math.floor((left + width) / TILE);
    const ty0 = Math.floor(top / TILE), ty1 = Math.floor((top + height) / TILE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, width, height);
    const jobs: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        jobs.push(
          loadTile(z, tx, ty).then((img) => {
            if (img) ctx.drawImage(img, tx * TILE - left, ty * TILE - top);
          })
        );
      }
    }
    await Promise.all(jobs);
    // Repère
    const cx = width / 2, cy = height / 2;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "rgba(220,38,38,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.warn("[roofMapImage] rendu impossible:", err);
    return null;
  }
}
