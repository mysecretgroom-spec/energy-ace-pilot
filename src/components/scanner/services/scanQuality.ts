export interface ScanPoint { x: number; y: number }
export interface ScanCorners {
  topLeft: ScanPoint; topRight: ScanPoint; bottomRight: ScanPoint; bottomLeft: ScanPoint;
}

export function rotateCorners(corners: ScanCorners, rotation: number): ScanCorners {
  let result = corners;
  for (let i = 0; i < ((rotation % 360) + 360) % 360 / 90; i++) {
    const rotate = (p: ScanPoint) => ({ x: 1 - p.y, y: p.x });
    result = { topLeft: rotate(result.bottomLeft), topRight: rotate(result.topLeft),
      bottomRight: rotate(result.topRight), bottomLeft: rotate(result.bottomRight) };
  }
  return result;
}

export function validScanCorners(corners: ScanCorners): boolean {
  const pts = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  if (pts.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  const crosses = pts.map((p, i) => {
    const q = pts[(i + 1) % 4], r = pts[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  });
  const area = pts.reduce((a, p, i) => a + p.x * pts[(i + 1) % 4].y - pts[(i + 1) % 4].x * p.y, 0) / 2;
  return crosses.every(c => c > 0.00001) && area > 0.005;
}

/** Estimate paper illumination from each tile's upper luminance percentile.
 * Interpolate a bounded gain; never threshold, synthesize text, or alter alpha.
 */
export function correctShadowPixels(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (width < 1 || height < 1 || source.length !== width * height * 4) throw new Error("Invalid image dimensions");
  const cols = Math.min(32, Math.max(1, Math.ceil(width / 48)));
  const rows = Math.min(32, Math.max(1, Math.ceil(height / 48)));
  const fields = new Float32Array(cols * rows);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const histogram = new Uint32Array(256);
    let count = 0;
    for (let y = Math.floor(ty * height / rows); y < Math.floor((ty + 1) * height / rows); y += 2)
      for (let x = Math.floor(tx * width / cols); x < Math.floor((tx + 1) * width / cols); x += 2) {
        const i = (y * width + x) * 4;
        histogram[Math.round(source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114)]++;
        count++;
      }
    let sum = 0, value = 255;
    for (let v = 0; v < 256; v++) { sum += histogram[v]; if (sum >= count * 0.85) { value = v; break; } }
    fields[ty * cols + tx] = value;
  }
  const sorted = Array.from(fields).sort((a, b) => a - b);
  const bright = sorted[Math.floor((sorted.length - 1) * 0.9)];
  const dark = sorted[Math.floor((sorted.length - 1) * 0.1)];
  // Do not brighten an evenly lit sheet. Uneven paper gets a neutral light target.
  const target = bright - dark > 12 ? Math.max(240, bright) : bright;
  const output = new Uint8ClampedArray(source);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const gx = Math.max(0, Math.min(cols - 1, (x + 0.5) * cols / width - 0.5));
    const gy = Math.max(0, Math.min(rows - 1, (y + 0.5) * rows / height - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const light = fields[y0 * cols + x0] * (1-fx) * (1-fy) + fields[y0 * cols + x1] * fx * (1-fy)
      + fields[y1 * cols + x0] * (1-fx) * fy + fields[y1 * cols + x1] * fx * fy;
    // A very dark tile is not reliable evidence of paper: leave it unchanged.
    const gain = light < 65 ? 1 : Math.max(1, Math.min(1.8, target / Math.max(1, light)));
    const i = (y * width + x) * 4;
    const peak = Math.max(source[i], source[i + 1], source[i + 2]);
    const luminance = source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114;
    // Ink is not illumination: retain dark strokes instead of washing them out.
    const paperRatio = Math.max(0, Math.min(1, (luminance / Math.max(1, light) - 0.15) / 0.75));
    const inkSafeGain = 1 + (gain - 1) * paperRatio * paperRatio * (3 - 2 * paperRatio);
    const safeGain = Math.min(inkSafeGain, 255 / Math.max(1, peak));
    for (let c = 0; c < 3; c++) output[i + c] = source[i + c] * safeGain;
  }
  return output;
}

export async function correctDocumentShadows(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve(); img.onerror = () => reject(new Error("Image illisible")); img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Traitement indisponible");
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pixels.data.set(correctShadowPixels(pixels.data, pixels.width, pixels.height));
    ctx.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  } finally { canvas.width = 0; canvas.height = 0; }
}