import type { Quad } from "../types";

/**
 * Check stability of detected quads over time.
 * Returns true if the last N quads are within threshold variance.
 */
export function isStable(history: Quad[], threshold = 8): boolean {
  if (history.length < 4) return false;

  const recent = history.slice(-5);
  const points = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

  for (const corner of points) {
    const xs = recent.map((q) => q[corner].x);
    const ys = recent.map((q) => q[corner].y);
    if (variance(xs) > threshold || variance(ys) > threshold) return false;
  }

  return true;
}

function variance(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

/**
 * Compute blur score (Laplacian variance).
 * Higher = sharper. Returns 0..1 normalized roughly.
 */
export function blurScore(
  gray: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): number {
  let sum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x];
      sum += lap * lap;
      count++;
    }
  }

  const variance = sum / count;
  // Normalize: typical sharp image ~500-2000, blurry <100
  return Math.min(1, variance / 1000);
}
