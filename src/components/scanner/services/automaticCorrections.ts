/** Conservative document corrections: retain source pixels and reject uncertain angles. */
export function documentContrast(source: Uint8ClampedArray): Uint8ClampedArray {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] === 0) continue;
    histogram[Math.round(source[i] * 0.299 + source[i + 1] * 0.587 + source[i + 2] * 0.114)]++;
    count++;
  }
  const percentile = (fraction: number) => {
    let sum = 0;
    for (let v = 0; v < 256; v++) { sum += histogram[v]; if (sum >= count * fraction) return v; }
    return 255;
  };
  const low = percentile(0.005), high = percentile(0.995);
  const result = new Uint8ClampedArray(source);
  if (!count || high - low < 30) return result;
  const gain = Math.min(1.6, 245 / (high - low));
  if (gain <= 1) return result;
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] === 0) continue;
    const peak = Math.max(source[i], source[i + 1], source[i + 2]);
    const floor = Math.min(source[i], source[i + 1], source[i + 2]);
    // One transform for all channels; bound it to avoid clipping colored annotations.
    const offset = Math.max(-floor * gain, Math.min(255 - peak * gain, 245 - high * gain));
    for (let c = 0; c < 3; c++) result[i + c] = source[i + c] * gain + offset;
  }
  return result;
}

/** Angle of text baselines, in degrees; zero means no reliable correction. */
/** Bounded detail recovery after resampling; never invent strokes or boost flat noise. */
export function sharpenDocumentPixels(source: Uint8ClampedArray, width: number, height: number, amount = 0.45, cap = 12): Uint8ClampedArray {
  if (source.length !== width * height * 4 || width < 1 || height < 1) throw new Error("Invalid image dimensions");
  const result = new Uint8ClampedArray(source);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      const average = (source[i - 4 + c] + source[i + 4 + c] + source[i - width * 4 + c] + source[i + width * 4 + c]) / 4;
      const detail = source[i + c] - average;
      if (Math.abs(detail) < 4 || Math.abs(detail) > 80) continue;
      result[i + c] = source[i + c] + Math.max(-cap, Math.min(cap, detail * amount));
    }
  }
  return result;
}

export function estimateDocumentSkew(gray: Uint8Array, width: number, height: number): number {
  if (width < 8 || height < 8 || gray.length !== width * height) return 0;
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value]++;
  let sum = 0, paper = 255;
  for (let v = 0; v < 256; v++) { sum += histogram[v]; if (sum >= gray.length * 0.8) { paper = v; break; } }
  const threshold = Math.min(160, paper - 40);
  const points: Array<[number, number]> = [];
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    if (gray[y * width + x] < threshold) points.push([x - width / 2, y - height / 2]);
  }
  if (points.length < width || points.length > gray.length * 0.3) return 0;
  const bins = Math.ceil(Math.hypot(width, height)) + 4;
  const score = (angle: number) => {
    const radians = angle * Math.PI / 180;
    const rows = new Uint32Array(bins);
    for (const [x, y] of points) rows[Math.round(y * Math.cos(radians) - x * Math.sin(radians) + bins / 2)]++;
    return rows.reduce((total, n) => total + n * n, 0);
  };
  const baseline = score(0);
  let best = baseline, angle = 0;
  for (let a = -12; a <= 12; a += 0.5) {
    const value = score(a);
    if (value > best) { best = value; angle = a; }
  }
  if (Math.abs(angle) < 0.5 || Math.abs(angle) >= 12 || best < baseline * 1.15) return 0;
  return angle;
}

export function deskewBounds(width: number, height: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    width: Math.ceil(width * Math.abs(Math.cos(radians)) + height * Math.abs(Math.sin(radians))),
    height: Math.ceil(height * Math.abs(Math.cos(radians)) + width * Math.abs(Math.sin(radians))),
  };
}

export interface DocumentTone { paper: number; ink: number; sharpness: number }

/** Paper/ink levels (luminance percentiles) and edge sharpness, measured on a subsample. */
export function analyzeDocumentTone(source: Uint8ClampedArray, width: number, height: number): DocumentTone {
  const histogram = new Uint32Array(256);
  const lum = (i: number) => (source[i] * 77 + source[i + 1] * 150 + source[i + 2] * 29) >> 8;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 250000)));
  let count = 0, edgeSum = 0, edgeCount = 0;
  for (let y = step; y < height - step; y += step) for (let x = step; x < width - step; x += step) {
    const i = (y * width + x) * 4;
    const v = lum(i);
    histogram[v]++; count++;
    const lap = Math.abs(4 * v - lum(i - 4) - lum(i + 4) - lum(i - width * 4) - lum(i + width * 4));
    const grad = Math.abs(lum(i + 4) - lum(i - 4)) + Math.abs(lum(i + width * 4) - lum(i - width * 4));
    if (grad > 24) { edgeSum += lap / grad; edgeCount++; }
  }
  const pct = (f: number) => { let sum = 0; for (let v = 0; v < 256; v++) { sum += histogram[v]; if (sum >= count * f) return v; } return 255; };
  return { paper: pct(0.9), ink: pct(0.03), sharpness: edgeCount ? edgeSum / edgeCount : 1 };
}

export interface AdaptiveParams { inkBoost: number; sharpenAmount: number; sharpenCap: number }

/**
 * Faded ink (small paper/ink gap) gets darker strokes; a soft photo gets more
 * detail recovery, an already crisp one almost none (avoids halos and noise).
 */
export function adaptiveDocumentParams(tone: DocumentTone): AdaptiveParams {
  const gap = tone.paper - tone.ink;
  const inkBoost = Math.max(0, Math.min(0.55, (150 - gap) / 180));
  // sharpness ≈ laplacian/gradient ratio: ~0.3 soft, ≥1 crisp.
  const softness = Math.max(0, Math.min(1, (1 - tone.sharpness) / 0.7));
  return { inkBoost, sharpenAmount: 0.15 + softness * 0.6, sharpenCap: Math.round(6 + softness * 14) };
}

/** Darkens pixels clearly below paper level; paper and light tints stay untouched. */
export function deepenInk(source: Uint8ClampedArray, tone: DocumentTone, boost: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source);
  if (boost <= 0) return result;
  const knee = tone.paper - 20;
  if (knee <= 20) return result;
  for (let i = 0; i < source.length; i += 4) {
    const l = (source[i] * 77 + source[i + 1] * 150 + source[i + 2] * 29) >> 8;
    if (l >= knee) continue;
    const t = 1 - l / knee; // 0 near paper, 1 for black
    const factor = 1 - boost * Math.sqrt(t) * (1 - t * 0.3);
    for (let c = 0; c < 3; c++) result[i + c] = source[i + c] * factor;
  }
  return result;
}
