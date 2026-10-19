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
export function sharpenDocumentPixels(source: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (source.length !== width * height * 4 || width < 1 || height < 1) throw new Error("Invalid image dimensions");
  const result = new Uint8ClampedArray(source);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      const average = (source[i - 4 + c] + source[i + 4 + c] + source[i - width * 4 + c] + source[i + width * 4 + c]) / 4;
      const detail = source[i + c] - average;
      if (Math.abs(detail) < 4 || Math.abs(detail) > 80) continue;
      result[i + c] = source[i + c] + Math.max(-12, Math.min(12, detail * 0.45));
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