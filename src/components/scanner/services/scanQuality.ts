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

/** Estimate paper illumination per colour channel from each tile's upper percentile,
 * smooth the field, then interpolate a bounded gain. Removes shadows, wrinkle shading and
 * yellow casts; never thresholds, synthesizes text, or alters alpha.
 */
export function correctShadowPixels(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (width < 1 || height < 1 || source.length !== width * height * 4) throw new Error("Invalid image dimensions");
  const cols = Math.min(40, Math.max(1, Math.ceil(width / 40)));
  const rows = Math.min(40, Math.max(1, Math.ceil(height / 40)));
  const raw = [new Float32Array(cols * rows), new Float32Array(cols * rows), new Float32Array(cols * rows)];
  const lum = new Float32Array(cols * rows);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    let count = 0;
    for (let y = Math.floor(ty * height / rows); y < Math.floor((ty + 1) * height / rows); y += 2)
      for (let x = Math.floor(tx * width / cols); x < Math.floor((tx + 1) * width / cols); x += 2) {
        const i = (y * width + x) * 4;
        h[0][source[i]]++; h[1][source[i + 1]]++; h[2][source[i + 2]]++;
        h[3][Math.round(source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114)]++;
        count++;
      }
    const pct = (hist: Uint32Array) => { let sum = 0; for (let v = 0; v < 256; v++) { sum += hist[v]; if (sum >= count * 0.85) return v; } return 255; };
    const k = ty * cols + tx;
    raw[0][k] = pct(h[0]); raw[1][k] = pct(h[1]); raw[2][k] = pct(h[2]); lum[k] = pct(h[3]);
  }
  // 3x3 smoothing: tiles covered by text/ink borrow light from neighbouring paper.
  const smooth = (f: Float32Array) => {
    const out = new Float32Array(f.length);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let best = 0, sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= rows || xx >= cols) continue;
        const v = f[yy * cols + xx]; sum += v; n++; if (v > best) best = v;
      }
      out[y * cols + x] = f[y * cols + x] * 0.4 + (sum / n) * 0.3 + best * 0.3;
    }
    return out;
  };
  const fields = raw.map(smooth);
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const bright = sorted[Math.floor((sorted.length - 1) * 0.9)];
  const dark = sorted[Math.floor((sorted.length - 1) * 0.1)];
  const spread = (k: number) => Math.max(fields[0][k], fields[1][k], fields[2][k]) - Math.min(fields[0][k], fields[1][k], fields[2][k]);
  let cast = 0; for (let k = 0; k < lum.length; k++) cast += spread(k); cast /= lum.length;
  // Evenly lit, neutral sheets are left as they are; uneven or tinted paper goes to a light neutral white.
  const correct = bright - dark > 12 || cast > 14;
  const target = correct ? Math.max(245, bright) : bright;
  const output = new Uint8ClampedArray(source);
  if (!correct) return output;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const gx = Math.max(0, Math.min(cols - 1, (x + 0.5) * cols / width - 0.5));
    const gy = Math.max(0, Math.min(rows - 1, (y + 0.5) * rows / height - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const w00 = (1-fx) * (1-fy), w10 = fx * (1-fy), w01 = (1-fx) * fy, w11 = fx * fy;
    const at = (f: Float32Array) => f[y0 * cols + x0] * w00 + f[y0 * cols + x1] * w10 + f[y1 * cols + x0] * w01 + f[y1 * cols + x1] * w11;
    const lr = at(fields[0]), lg = at(fields[1]), lb = at(fields[2]);
    const light = lr * 0.299 + lg * 0.587 + lb * 0.114;
    const i = (y * width + x) * 4;
    // A very dark tile is not reliable evidence of paper: leave it unchanged.
    if (light < 65) continue;
    const luminance = source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114;
    // Ink is not illumination: retain dark strokes instead of washing them out.
    const paperRatio = Math.max(0, Math.min(1, (luminance / Math.max(1, light) - 0.15) / 0.75));
    const blend = paperRatio * paperRatio * (3 - 2 * paperRatio);
    const lights = [lr, lg, lb];
    for (let c = 0; c < 3; c++) {
      const gain = Math.max(0.85, Math.min(2.2, target / Math.max(1, lights[c])));
      // Ink keeps its own values; paper takes the per-channel gain.
      output[i + c] = source[i + c] * (1 + (gain - 1) * blend);
    }
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