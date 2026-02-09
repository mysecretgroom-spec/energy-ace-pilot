/**
 * Lightweight document edge detection — pure JS/Canvas, no OpenCV needed (~3KB vs 8MB).
 * Uses grayscale → blur → Sobel edges → contour tracing → largest quad detection.
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
        const maxDim = 400;
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

        // 3. Sobel edge detection
        const edges = sobelEdges(blurred, w, h);

        // 4. Threshold
        const threshold = otsuThreshold(edges);
        const binary = new Uint8Array(w * h);
        for (let i = 0; i < edges.length; i++) {
          binary[i] = edges[i] > threshold ? 255 : 0;
        }

        // 5. Find contours and detect largest quad
        const quad = findLargestQuad(binary, w, h);
        
        if (quad) {
          const area = quadArea(quad);
          const imageArea = w * h;
          const confidence = Math.min(area / imageArea, 1);

          // Must cover at least 15% of image
          if (confidence > 0.15) {
            // Normalize to 0-1
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
 * Simple contour-based quad detection:
 * Scan edge pixels, find connected components, approximate to polygon,
 * and pick the largest 4-sided polygon.
 */
function findLargestQuad(binary: Uint8Array, w: number, h: number): Point[] | null {
  // Find edge points using boundary tracing
  const edgePoints: Point[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (binary[y * w + x] === 255) {
        edgePoints.push({ x, y });
      }
    }
  }

  if (edgePoints.length < 20) return null;

  // Use convex hull to find the outer boundary
  const hull = convexHull(edgePoints);
  if (hull.length < 4) return null;

  // Approximate hull to 4 points using Ramer-Douglas-Peucker
  let approx = hull;
  let epsilon = perimeter(hull) * 0.01;
  
  for (let iter = 0; iter < 50; iter++) {
    approx = rdpSimplify(hull, epsilon);
    if (approx.length <= 4) break;
    epsilon *= 1.1;
  }

  // If we got exactly 4 points, great
  if (approx.length === 4) return approx;

  // If more than 4, pick the 4 most extreme points
  if (approx.length > 4) {
    return pickBestQuad(approx);
  }

  return null;
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  // Sort by x, then y
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  // Sample points if too many (performance)
  let pts = sorted;
  if (pts.length > 2000) {
    const step = Math.ceil(pts.length / 2000);
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
  // Pick the 4 points that form the largest area quadrilateral
  // Simple heuristic: pick corners closest to image corners
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  // Classify points into quadrants relative to centroid
  const quadrants: [Point[], Point[], Point[], Point[]] = [[], [], [], []];
  for (const p of points) {
    const qx = p.x < cx ? 0 : 1;
    const qy = p.y < cy ? 0 : 1;
    quadrants[qy * 2 + qx].push(p);
  }

  const result: Point[] = [];
  // TL (0), TR (1), BL (2), BR (3)
  for (const quad of quadrants) {
    if (quad.length === 0) return points.slice(0, 4); // fallback
    // Pick the point furthest from centroid in this quadrant
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
  // Shoelace formula
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
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
  return {
    topLeft: top[0],
    topRight: top[1],
    bottomRight: bottom[1],
    bottomLeft: bottom[0],
  };
}
