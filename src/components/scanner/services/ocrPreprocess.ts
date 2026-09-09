/**
 * OCR preprocessing pipeline (CamScanner-like).
 *
 * 1. Upscale small captures so text is at least ~20px tall for Tesseract.
 * 2. Grayscale (luminance).
 * 3. Illumination normalisation: divide by a large-window local mean
 *    (removes shadows, gradients, phone-flash hotspots on glossy tickets).
 * 4. Sauvola adaptive binarisation (robust on thermal receipts).
 *
 * Both intermediate results are exposed so the OCR layer can retry with the
 * grey (non-binarised) version when binarisation hurts.
 */

const MIN_OCR_WIDTH = 1600;
const MAX_OCR_WIDTH = 3000;

export interface PreprocessedImage {
  /** Illumination-normalised greyscale PNG */
  grey: string;
  /** Sauvola-binarised PNG (black text on white) */
  binary: string;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

/** Integral image (summed-area table) with a 1px zero border. */
function buildIntegrals(gray: Float64Array, w: number, h: number) {
  const sw = w + 1;
  const sum = new Float64Array(sw * (h + 1));
  const sqSum = new Float64Array(sw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x];
      rowSum += v;
      rowSq += v * v;
      sum[(y + 1) * sw + (x + 1)] = sum[y * sw + (x + 1)] + rowSum;
      sqSum[(y + 1) * sw + (x + 1)] = sqSum[y * sw + (x + 1)] + rowSq;
    }
  }
  return { sum, sqSum, sw };
}

function boxStats(
  sum: Float64Array,
  sqSum: Float64Array,
  sw: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  const a = y0 * sw + x0;
  const b = y0 * sw + x1;
  const c = y1 * sw + x0;
  const d = y1 * sw + x1;
  const count = (x1 - x0) * (y1 - y0);
  const s = sum[d] - sum[b] - sum[c] + sum[a];
  const sq = sqSum[d] - sqSum[b] - sqSum[c] + sqSum[a];
  const mean = s / count;
  const variance = Math.max(0, sq / count - mean * mean);
  return { mean, std: Math.sqrt(variance) };
}

export async function preprocessForOcr(imageData: string): Promise<PreprocessedImage> {
  const img = await loadImage(imageData);

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  let scale = 1;
  if (w < MIN_OCR_WIDTH) scale = MIN_OCR_WIDTH / w;
  if (w * scale > MAX_OCR_WIDTH) scale = MAX_OCR_WIDTH / w;
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const src = ctx.getImageData(0, 0, w, h);
  const px = src.data;
  const gray = new Float64Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
  }

  // --- 1. Illumination normalisation (divide by large local mean) ---
  const bg = buildIntegrals(gray, w, h);
  const bgRadius = Math.max(15, Math.round(Math.min(w, h) / 12));
  const normalized = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - bgRadius);
    const y1 = Math.min(h, y + bgRadius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - bgRadius);
      const x1 = Math.min(w, x + bgRadius + 1);
      const { mean } = boxStats(bg.sum, bg.sqSum, bg.sw, x0, y0, x1, y1);
      const v = (gray[y * w + x] / Math.max(1, mean)) * 200;
      normalized[y * w + x] = v > 255 ? 255 : v < 0 ? 0 : v;
    }
  }

  // Write greyscale output
  const greyData = ctx.createImageData(w, h);
  for (let i = 0, p = 0; i < normalized.length; i++, p += 4) {
    const v = normalized[i];
    greyData.data[p] = greyData.data[p + 1] = greyData.data[p + 2] = v;
    greyData.data[p + 3] = 255;
  }
  ctx.putImageData(greyData, 0, 0);
  const grey = canvas.toDataURL("image/png");

  // --- 2. Sauvola adaptive threshold on the normalised image ---
  const nrm = buildIntegrals(normalized, w, h);
  const win = Math.max(15, Math.round(Math.min(w, h) / 40)) | 1;
  const r = Math.floor(win / 2);
  const k = 0.28;
  const R = 128;
  const binData = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const { mean, std } = boxStats(nrm.sum, nrm.sqSum, nrm.sw, x0, y0, x1, y1);
      const threshold = mean * (1 + k * (std / R - 1));
      const v = normalized[y * w + x] > threshold ? 255 : 0;
      const p = (y * w + x) * 4;
      binData.data[p] = binData.data[p + 1] = binData.data[p + 2] = v;
      binData.data[p + 3] = 255;
    }
  }
  ctx.putImageData(binData, 0, 0);
  const binary = canvas.toDataURL("image/png");

  canvas.width = 0;
  canvas.height = 0;

  return { grey, binary, width: w, height: h };
}
