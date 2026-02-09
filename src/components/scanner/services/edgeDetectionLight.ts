/**
 * Lightweight document edge detection — pure JS/Canvas, no OpenCV needed.
 * Uses grayscale → blur → adaptive threshold → Canny-like edges → contour → largest quad.
 * Optimised for receipts / documents on dark or textured backgrounds.
 */

interface Point {
  x: number;
  y: number;
}

export interface LightDetectedEdges {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

/**
 * Detect document edges from a data URL image.
 * Returns normalized (0-1) corner coordinates or null if no document found.
 */
export async function detectDocumentEdgesLight(
  imageData: string
): Promise<LightDetectedEdges | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Work at reduced resolution for speed
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(maxDim / w, maxDim / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }

        ctx.drawImage(img, 0, 0, w, h);
        const imageDataObj = ctx.getImageData(0, 0, w, h);
        const pixels = imageDataObj.data;

        // 1. Grayscale
        const gray = new Uint8Array(w * h);
        for (let i = 0; i < gray.length; i++) {
          const p = i * 4;
          gray[i] = Math.round(pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114);
        }

        // 2. Gaussian blur 5x5
        const blurred = gaussianBlur(gray, w, h);

        // 3. Adaptive threshold to handle uneven lighting
        const adaptiveBin = adaptiveThreshold(blurred, w, h, 25, 8);

        // 4. Sobel edge detection on blurred image
        const edges = sobelEdges(blurred, w, h);

        // 5. Canny-like: non-maximum suppression + hysteresis threshold
        const cannyEdges = cannyNMS(edges, blurred, w, h);

        // 6. Combine: edge AND near adaptive-threshold boundary
        const combined = new Uint8Array(w * h);
        // Dilate the adaptive threshold to get boundary region
        const dilated = dilate(adaptiveBin, w, h, 3);
        const eroded = erode(adaptiveBin, w, h, 3);
        for (let i = 0; i < w * h; i++) {
          // Boundary = dilated XOR eroded (pixels near the edge of white regions)
          const isBoundary = dilated[i] !== eroded[i] ? 1 : 0;
          // Use Canny edges, boosted at boundary regions
          combined[i] = cannyEdges[i] > 0 || (edges[i] > 40 && isBoundary) ? 255 : 0;
        }

        // 7. Dilate edges to connect fragments
        const connectedEdges = dilate(combined, w, h, 2);

        // 8. Find contours and detect largest quad
        const quad = findLargestQuad(connectedEdges, w, h);

        if (quad) {
          const area = quadArea(quad);
          const imageArea = w * h;
          const confidence = Math.min(area / imageArea, 1);

          // Must cover at least 10% of image
          if (confidence > 0.10) {
            const sorted = sortCorners(quad);
            resolve({
              topLeft: { x: sorted.topLeft.x / w, y: sorted.topLeft.y / h },
              topRight: { x: sorted.topRight.x / w, y: sorted.topRight.y / h },
              bottomRight: { x: sorted.bottomRight.x / w, y: sorted.bottomRight.y / h },
              bottomLeft: { x: sorted.bottomLeft.x / w, y: sorted.bottomLeft.y / h },
              confidence,
            });
            return;
          }
        }

        resolve(null);
      } catch (err) {
        console.error("Light edge detection error:", err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageData;
  });
}

// ---- Internal helpers ----

function gaussianBlur(src: Uint8Array, w: number, h: number): Uint8Array {
  const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
  const kSum = 256;
  const out = new Uint8Array(w * h);

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let sum = 0;
      let ki = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          sum += src[(y + ky) * w + (x + kx)] * kernel[ki++];
        }
      }
      out[y * w + x] = (sum / kSum) | 0;
    }
  }
  return out;
}

function sobelEdges(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -src[(y - 1) * w + (x - 1)] - 2 * src[y * w + (x - 1)] - src[(y + 1) * w + (x - 1)] +
        src[(y - 1) * w + (x + 1)] + 2 * src[y * w + (x + 1)] + src[(y + 1) * w + (x + 1)];
      const gy =
        -src[(y - 1) * w + (x - 1)] - 2 * src[(y - 1) * w + x] - src[(y - 1) * w + (x + 1)] +
        src[(y + 1) * w + (x - 1)] + 2 * src[(y + 1) * w + x] + src[(y + 1) * w + (x + 1)];
      out[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy) | 0);
    }
  }
  return out;
}

/** Adaptive threshold using mean of local window */
function adaptiveThreshold(src: Uint8Array, w: number, h: number, blockSize: number, C: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const half = (blockSize >> 1);

  // Integral image for fast mean computation
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                - integral[y1 * (w + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (w + 1) + x1]
                + integral[y1 * (w + 1) + x1];
      const mean = sum / count;
      out[y * w + x] = src[y * w + x] > mean - C ? 255 : 0;
    }
  }
  return out;
}

/** Canny-like non-maximum suppression for cleaner edges */
function cannyNMS(magnitude: Uint8Array, blurred: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);

  // Compute gradient directions from blurred
  const directions = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = blurred[y * w + x + 1] - blurred[y * w + x - 1];
      const gy = blurred[(y + 1) * w + x] - blurred[(y - 1) * w + x];
      directions[y * w + x] = Math.atan2(gy, gx);
    }
  }

  // NMS
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const mag = magnitude[idx];
      if (mag < 20) continue;

      const angle = ((directions[idx] * 180 / Math.PI) + 180) % 180;
      let n1 = 0, n2 = 0;

      if (angle < 22.5 || angle >= 157.5) {
        n1 = magnitude[idx - 1]; n2 = magnitude[idx + 1];
      } else if (angle < 67.5) {
        n1 = magnitude[(y - 1) * w + x + 1]; n2 = magnitude[(y + 1) * w + x - 1];
      } else if (angle < 112.5) {
        n1 = magnitude[(y - 1) * w + x]; n2 = magnitude[(y + 1) * w + x];
      } else {
        n1 = magnitude[(y - 1) * w + x - 1]; n2 = magnitude[(y + 1) * w + x + 1];
      }

      out[idx] = mag >= n1 && mag >= n2 ? mag : 0;
    }
  }

  // Hysteresis thresholding
  const highThresh = otsuThreshold(magnitude) * 0.8;
  const lowThresh = highThresh * 0.4;
  const result = new Uint8Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (out[idx] >= highThresh) {
        result[idx] = 255;
      } else if (out[idx] >= lowThresh) {
        // Check 8-connected neighbors for a strong edge
        let hasStrong = false;
        for (let dy = -1; dy <= 1 && !hasStrong; dy++) {
          for (let dx = -1; dx <= 1 && !hasStrong; dx++) {
            if (out[(y + dy) * w + (x + dx)] >= highThresh) hasStrong = true;
          }
        }
        if (hasStrong) result[idx] = 255;
      }
    }
  }

  return result;
}

/** Morphological dilate */
function dilate(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      let max = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const v = src[(y + dy) * w + (x + dx)];
          if (v > max) max = v;
        }
      }
      out[y * w + x] = max;
    }
  }
  return out;
}

/** Morphological erode */
function erode(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  out.fill(255);
  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      let min = 255;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const v = src[(y + dy) * w + (x + dx)];
          if (v < min) min = v;
        }
      }
      out[y * w + x] = min;
    }
  }
  return out;
}

function otsuThreshold(data: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;

  const total = data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVar) {
      maxVar = variance;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Find the largest quad from edge image using contour + convex hull + RDP simplification.
 */
function findLargestQuad(binary: Uint8Array, w: number, h: number): Point[] | null {
  const edgePoints: Point[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (binary[y * w + x] === 255) {
        edgePoints.push({ x, y });
      }
    }
  }

  if (edgePoints.length < 20) return null;

  const hull = convexHull(edgePoints);
  if (hull.length < 4) return null;

  // Approximate hull to 4 points using Ramer-Douglas-Peucker
  let approx = hull;
  let epsilon = perimeter(hull) * 0.015;

  for (let iter = 0; iter < 60; iter++) {
    approx = rdpSimplify(hull, epsilon);
    if (approx.length <= 4) break;
    epsilon *= 1.1;
  }

  if (approx.length === 4) return approx;
  if (approx.length > 4) return pickBestQuad(approx);

  return null;
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  let pts = sorted;
  if (pts.length > 3000) {
    const step = Math.ceil(pts.length / 3000);
    pts = pts.filter((_, i) => i % step === 0);
  }

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function perimeter(points: Point[]): number {
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    p += Math.sqrt((points[j].x - points[i].x) ** 2 + (points[j].y - points[i].y) ** 2);
  }
  return p;
}

function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

function pointLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

function pickBestQuad(points: Point[]): Point[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  const quadrants: [Point[], Point[], Point[], Point[]] = [[], [], [], []];
  for (const p of points) {
    const qx = p.x < cx ? 0 : 1;
    const qy = p.y < cy ? 0 : 1;
    quadrants[qy * 2 + qx].push(p);
  }

  const result: Point[] = [];
  for (const quad of quadrants) {
    if (quad.length === 0) return points.slice(0, 4);
    let best = quad[0];
    let bestDist = 0;
    for (const p of quad) {
      const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
      if (d > bestDist) {
        bestDist = d;
        best = p;
      }
    }
    result.push(best);
  }

  return result;
}

function quadArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function sortCorners(points: Point[]): {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
} {
  // Sort by sum (x+y) and difference (x-y) for robust corner assignment
  const sorted = [...points];
  const sums = sorted.map(p => p.x + p.y);
  const diffs = sorted.map(p => p.x - p.y);

  const topLeftIdx = sums.indexOf(Math.min(...sums));
  const bottomRightIdx = sums.indexOf(Math.max(...sums));
  const topRightIdx = diffs.indexOf(Math.max(...diffs));
  const bottomLeftIdx = diffs.indexOf(Math.min(...diffs));

  return {
    topLeft: sorted[topLeftIdx],
    topRight: sorted[topRightIdx],
    bottomRight: sorted[bottomRightIdx],
    bottomLeft: sorted[bottomLeftIdx],
  };
}
