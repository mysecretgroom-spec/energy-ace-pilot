import type { Quad } from "../types";
import { MAX_OUTPUT_DIM } from "../types";

/**
 * Compute 3x3 homography matrix from srcQuad to dstRect using 8x8 linear system.
 * Uses Gauss elimination with partial pivoting.
 */
export function computeHomography(
  src: [number, number, number, number, number, number, number, number], // x0,y0, x1,y1, x2,y2, x3,y3
  dst: [number, number, number, number, number, number, number, number]
): Float64Array {
  // Build 8x9 augmented matrix for Ah = b
  const A = new Float64Array(8 * 9);

  for (let i = 0; i < 4; i++) {
    const sx = src[i * 2], sy = src[i * 2 + 1];
    const dx = dst[i * 2], dy = dst[i * 2 + 1];
    const r1 = i * 2;
    const r2 = i * 2 + 1;

    // Row r1: sx, sy, 1, 0, 0, 0, -dx*sx, -dx*sy | dx
    A[r1 * 9 + 0] = sx; A[r1 * 9 + 1] = sy; A[r1 * 9 + 2] = 1;
    A[r1 * 9 + 3] = 0;  A[r1 * 9 + 4] = 0;  A[r1 * 9 + 5] = 0;
    A[r1 * 9 + 6] = -dx * sx; A[r1 * 9 + 7] = -dx * sy;
    A[r1 * 9 + 8] = dx;

    // Row r2: 0, 0, 0, sx, sy, 1, -dy*sx, -dy*sy | dy
    A[r2 * 9 + 0] = 0;  A[r2 * 9 + 1] = 0;  A[r2 * 9 + 2] = 0;
    A[r2 * 9 + 3] = sx; A[r2 * 9 + 4] = sy; A[r2 * 9 + 5] = 1;
    A[r2 * 9 + 6] = -dy * sx; A[r2 * 9 + 7] = -dy * sy;
    A[r2 * 9 + 8] = dy;
  }

  // Gauss elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    // Find pivot
    let maxVal = Math.abs(A[col * 9 + col]);
    let maxRow = col;
    for (let row = col + 1; row < 8; row++) {
      const v = Math.abs(A[row * 9 + col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }

    // Swap rows
    if (maxRow !== col) {
      for (let j = 0; j < 9; j++) {
        const tmp = A[col * 9 + j];
        A[col * 9 + j] = A[maxRow * 9 + j];
        A[maxRow * 9 + j] = tmp;
      }
    }

    const pivot = A[col * 9 + col];
    if (Math.abs(pivot) < 1e-12) continue; // singular

    // Eliminate
    for (let row = col + 1; row < 8; row++) {
      const factor = A[row * 9 + col] / pivot;
      for (let j = col; j < 9; j++) {
        A[row * 9 + j] -= factor * A[col * 9 + j];
      }
    }
  }

  // Back substitution
  const h = new Float64Array(9);
  for (let i = 7; i >= 0; i--) {
    let sum = A[i * 9 + 8];
    for (let j = i + 1; j < 8; j++) {
      sum -= A[i * 9 + j] * h[j];
    }
    h[i] = sum / A[i * 9 + i];
  }
  h[8] = 1.0;

  return h;
}

/**
 * Warp perspective: apply inverse homography with bilinear sampling.
 * srcPixels: RGBA Uint8ClampedArray of source image.
 */
export function warpPerspective(
  srcPixels: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  H: Float64Array,
  outW: number,
  outH: number
): Uint8ClampedArray {
  // Cap output
  if (outW > MAX_OUTPUT_DIM || outH > MAX_OUTPUT_DIM) {
    const s = MAX_OUTPUT_DIM / Math.max(outW, outH);
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const dst = new Uint8ClampedArray(outW * outH * 4);

  // Compute inverse homography (dst -> src)
  const Hinv = invertH(H);

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      // Map destination pixel to source
      const w = Hinv[6] * dx + Hinv[7] * dy + Hinv[8];
      if (Math.abs(w) < 1e-10) continue;
      const sx = (Hinv[0] * dx + Hinv[1] * dy + Hinv[2]) / w;
      const sy = (Hinv[3] * dx + Hinv[4] * dy + Hinv[5]) / w;

      // Bilinear sampling
      if (sx < 0 || sy < 0 || sx >= srcW - 1 || sy >= srcH - 1) continue;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;

      const idx00 = (y0 * srcW + x0) * 4;
      const idx10 = idx00 + 4;
      const idx01 = ((y0 + 1) * srcW + x0) * 4;
      const idx11 = idx01 + 4;

      const dstIdx = (dy * outW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        dst[dstIdx + c] = Math.round(
          srcPixels[idx00 + c] * (1 - fx) * (1 - fy) +
          srcPixels[idx10 + c] * fx * (1 - fy) +
          srcPixels[idx01 + c] * (1 - fx) * fy +
          srcPixels[idx11 + c] * fx * fy
        );
      }
    }
  }

  return dst;
}

/** Invert a 3x3 homography matrix */
function invertH(H: Float64Array): Float64Array {
  const [a, b, c, d, e, f, g, h, i] = H;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return new Float64Array(9); // degenerate

  const inv = new Float64Array(9);
  inv[0] = (e * i - f * h) / det;
  inv[1] = (c * h - b * i) / det;
  inv[2] = (b * f - c * e) / det;
  inv[3] = (f * g - d * i) / det;
  inv[4] = (a * i - c * g) / det;
  inv[5] = (c * d - a * f) / det;
  inv[6] = (d * h - e * g) / det;
  inv[7] = (b * g - a * h) / det;
  inv[8] = (a * e - b * d) / det;

  return inv;
}

/**
 * Helper: build src/dst arrays from Quad and output size, then compute H.
 */
export function computeHomographyFromQuad(quad: Quad, outW: number, outH: number): Float64Array {
  const src: [number, number, number, number, number, number, number, number] = [
    quad.topLeft.x, quad.topLeft.y,
    quad.topRight.x, quad.topRight.y,
    quad.bottomRight.x, quad.bottomRight.y,
    quad.bottomLeft.x, quad.bottomLeft.y,
  ];
  const dst: [number, number, number, number, number, number, number, number] = [
    0, 0,
    outW, 0,
    outW, outH,
    0, outH,
  ];
  return computeHomography(src, dst);
}
