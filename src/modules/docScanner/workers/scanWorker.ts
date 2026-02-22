/**
 * scanWorker.ts — Document detection + warp + filters pipeline.
 * Runs off main thread via Web Worker.
 */

// We inline the needed utils here since workers can't import from the module system directly.

// ─── Quad utilities ───

interface Point { x: number; y: number }
interface Quad { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point }

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function orderQuad(points: Point[]): Quad {
  const sorted = [...points];
  sorted.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft = sorted[0];
  const bottomRight = sorted[3];
  sorted.sort((a, b) => (a.y - a.x) - (b.y - b.x));
  const topRight = sorted[0];
  const bottomLeft = sorted[3];
  return { topLeft, topRight, bottomRight, bottomLeft };
}

function computeOutputSize(quad: Quad, maxDim = 2048): { w: number; h: number } {
  const topW = dist(quad.topLeft, quad.topRight);
  const bottomW = dist(quad.bottomLeft, quad.bottomRight);
  const leftH = dist(quad.topLeft, quad.bottomLeft);
  const rightH = dist(quad.topRight, quad.bottomRight);
  let w = Math.round(Math.max(topW, bottomW));
  let h = Math.round(Math.max(leftH, rightH));
  if (w > maxDim || h > maxDim) {
    const s = maxDim / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

function confidenceScore(quad: Quad, imageW: number, imageH: number): number {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  area = Math.abs(area) / 2;
  const areaRatio = area / (imageW * imageH);
  const areaScore = areaRatio >= 0.05 && areaRatio <= 0.98 ? Math.min(areaRatio * 2, 1) : 0.1;

  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4], curr = pts[i], next = pts[(i + 1) % 4];
    const v1x = prev.x - curr.x, v1y = prev.y - curr.y;
    const v2x = next.x - curr.x, v2y = next.y - curr.y;
    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;
    angles.push(Math.abs(Math.atan2(cross, dot) * 180 / Math.PI));
  }
  const angleScore = Math.max(0, 1 - angles.reduce((s, a) => s + Math.abs(a - 90), 0) / 4 / 45);

  let convex = true, sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) { convex = false; break; }
  }

  return areaScore * 0.35 + angleScore * 0.4 + (convex ? 1 : 0.3) * 0.25;
}

// ─── Image processing ───

function toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114);
  }
  return gray;
}

function gaussianBlur5x5(gray: Uint8Array, w: number, h: number): Uint8Array {
  const kernel = [1, 4, 6, 4, 1];
  const kSum = 256; // 16*16
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        sum += gray[y * w + xx] * kernel[k + 2];
      }
      tmp[y * w + x] = sum >> 4;
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        sum += tmp[yy * w + x] * kernel[k + 2];
      }
      out[y * w + x] = sum >> 4;
    }
  }

  return out;
}

function sobelEdges(gray: Uint8Array, w: number, h: number): { magnitude: Uint8Array; direction: Float32Array } {
  const mag = new Uint8Array(w * h);
  const dir = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[y * w + (x - 1)] - gray[(y + 1) * w + (x - 1)] +
        gray[(y - 1) * w + (x + 1)] + 2 * gray[y * w + (x + 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];

      mag[idx] = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
      dir[idx] = Math.atan2(gy, gx);
    }
  }

  return { magnitude: mag, direction: dir };
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
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
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) { maxVar = varBetween; threshold = t; }
  }

  return threshold;
}

function nonMaxSuppression(mag: Uint8Array, dir: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const m = mag[idx];
      if (m === 0) continue;

      let angle = dir[idx] * 180 / Math.PI;
      if (angle < 0) angle += 180;

      let n1 = 0, n2 = 0;
      if ((angle < 22.5) || (angle >= 157.5)) {
        n1 = mag[idx + 1]; n2 = mag[idx - 1];
      } else if (angle < 67.5) {
        n1 = mag[(y - 1) * w + (x + 1)]; n2 = mag[(y + 1) * w + (x - 1)];
      } else if (angle < 112.5) {
        n1 = mag[(y - 1) * w + x]; n2 = mag[(y + 1) * w + x];
      } else {
        n1 = mag[(y - 1) * w + (x - 1)]; n2 = mag[(y + 1) * w + (x + 1)];
      }

      out[idx] = (m >= n1 && m >= n2) ? m : 0;
    }
  }

  return out;
}

function hysteresis(nms: Uint8Array, w: number, h: number, low: number, high: number): Uint8Array {
  const out = new Uint8Array(w * h);

  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= high) out[i] = 255;
    else if (nms[i] >= low) out[i] = 128; // weak
  }

  // Connect weak edges to strong
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (out[idx] !== 128) continue;
        // Check 8-neighbors for strong
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (out[(y + dy) * w + (x + dx)] === 255) {
              out[idx] = 255;
              changed = true;
              break;
            }
          }
          if (out[idx] === 255) break;
        }
      }
    }
  }

  // Remove weak edges
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 255) out[i] = 0;
  }

  return out;
}

/** Merge contours that are spatially close — they likely belong to the same document edge */
function mergeNearbyContours(contours: Point[][], threshold: number): Point[][] {
  if (contours.length <= 1) return contours;

  // Compute bounding box center for each contour
  const centers = contours.map((c) => {
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  });

  const merged: boolean[] = new Array(contours.length).fill(false);
  const result: Point[][] = [];

  for (let i = 0; i < contours.length; i++) {
    if (merged[i]) continue;
    let group = [...contours[i]];
    merged[i] = true;
    for (let j = i + 1; j < contours.length; j++) {
      if (merged[j]) continue;
      const d = dist(centers[i], centers[j]);
      if (d < threshold * 4) {
        group = group.concat(contours[j]);
        merged[j] = true;
      }
    }
    result.push(group);
  }
  return result;
}

function findLargestQuadContour(edges: Uint8Array, w: number, h: number): Point[] | null {
  // Find connected components and their bounding contours
  const visited = new Uint8Array(w * h);
  const contours: Point[][] = [];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (edges[idx] !== 255 || visited[idx]) continue;

      // BFS to find connected edge pixels
      const component: Point[] = [];
      const queue: number[] = [idx];
      visited[idx] = 1;

      while (queue.length > 0 && component.length < 10000) {
        const ci = queue.pop()!;
        const cy = Math.floor(ci / w);
        const cx = ci % w;
        component.push({ x: cx, y: cy });

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = cy + dy, nx = cx + dx;
            if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
            const ni = ny * w + nx;
            if (!visited[ni] && edges[ni] === 255) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }

      if (component.length > 30) {
        contours.push(component);
      }
    }
  }

  if (contours.length === 0) return null;

  // Merge nearby contours that likely belong to the same document edge
  const merged = mergeNearbyContours(contours, Math.min(w, h) * 0.05);

  // Find the contour with largest convex hull area
  let bestQuad: Point[] | null = null;
  let bestArea = 0;

  for (const contour of merged) {
    const hull = convexHull(contour);
    if (hull.length < 4) continue;

    const simplified = simplifyToQuad(hull);
    if (!simplified) continue;

    // Calculate area
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      area += simplified[i].x * simplified[j].y - simplified[j].x * simplified[i].y;
    }
    area = Math.abs(area) / 2;

    if (area > bestArea && area > w * h * 0.02) {
      bestArea = area;
      bestQuad = simplified;
    }
  }

  return bestQuad;
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function simplifyToQuad(hull: Point[]): Point[] | null {
  if (hull.length < 4) return null;
  if (hull.length === 4) return hull;

  // Douglas-Peucker-like: find 4 most extreme points
  // Use bounding box corners: find hull points closest to each corner
  const minX = Math.min(...hull.map(p => p.x));
  const maxX = Math.max(...hull.map(p => p.x));
  const minY = Math.min(...hull.map(p => p.y));
  const maxY = Math.max(...hull.map(p => p.y));

  const corners = [
    { x: minX, y: minY }, // TL
    { x: maxX, y: minY }, // TR
    { x: maxX, y: maxY }, // BR
    { x: minX, y: maxY }, // BL
  ];

  const result: Point[] = [];
  const used = new Set<number>();

  for (const corner of corners) {
    let bestDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < hull.length; i++) {
      if (used.has(i)) continue;
      const d = dist(hull[i], corner);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    used.add(bestIdx);
    result.push(hull[bestIdx]);
  }

  return result.length === 4 ? result : null;
}

// ─── Homography (inlined for worker) ───

function computeHomography(
  src: number[], // [x0,y0, x1,y1, x2,y2, x3,y3]
  dst: number[]
): Float64Array {
  const A = new Float64Array(8 * 9);
  for (let i = 0; i < 4; i++) {
    const sx = src[i * 2], sy = src[i * 2 + 1];
    const dx = dst[i * 2], dy = dst[i * 2 + 1];
    const r1 = i * 2, r2 = i * 2 + 1;
    A[r1*9+0]=sx; A[r1*9+1]=sy; A[r1*9+2]=1; A[r1*9+3]=0; A[r1*9+4]=0; A[r1*9+5]=0;
    A[r1*9+6]=-dx*sx; A[r1*9+7]=-dx*sy; A[r1*9+8]=dx;
    A[r2*9+0]=0; A[r2*9+1]=0; A[r2*9+2]=0; A[r2*9+3]=sx; A[r2*9+4]=sy; A[r2*9+5]=1;
    A[r2*9+6]=-dy*sx; A[r2*9+7]=-dy*sy; A[r2*9+8]=dy;
  }
  for (let col = 0; col < 8; col++) {
    let maxVal = Math.abs(A[col*9+col]), maxRow = col;
    for (let row = col+1; row < 8; row++) {
      const v = Math.abs(A[row*9+col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxRow !== col) {
      for (let j = 0; j < 9; j++) {
        const tmp = A[col*9+j]; A[col*9+j] = A[maxRow*9+j]; A[maxRow*9+j] = tmp;
      }
    }
    const pivot = A[col*9+col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = col+1; row < 8; row++) {
      const f = A[row*9+col] / pivot;
      for (let j = col; j < 9; j++) A[row*9+j] -= f * A[col*9+j];
    }
  }
  const h = new Float64Array(9);
  for (let i = 7; i >= 0; i--) {
    let s = A[i*9+8];
    for (let j = i+1; j < 8; j++) s -= A[i*9+j] * h[j];
    h[i] = s / A[i*9+i];
  }
  h[8] = 1.0;
  return h;
}

function invertH(H: Float64Array): Float64Array {
  const [a,b,c,d,e,f,g,h,i] = H;
  const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g);
  if (Math.abs(det) < 1e-12) return new Float64Array(9);
  const inv = new Float64Array(9);
  inv[0]=(e*i-f*h)/det; inv[1]=(c*h-b*i)/det; inv[2]=(b*f-c*e)/det;
  inv[3]=(f*g-d*i)/det; inv[4]=(a*i-c*g)/det; inv[5]=(c*d-a*f)/det;
  inv[6]=(d*h-e*g)/det; inv[7]=(b*g-a*h)/det; inv[8]=(a*e-b*d)/det;
  return inv;
}

function warpPerspective(
  srcPixels: Uint8ClampedArray, srcW: number, srcH: number,
  quad: Quad, outW: number, outH: number
): Uint8ClampedArray {
  const src = [
    quad.topLeft.x, quad.topLeft.y, quad.topRight.x, quad.topRight.y,
    quad.bottomRight.x, quad.bottomRight.y, quad.bottomLeft.x, quad.bottomLeft.y,
  ];
  const dst = [0, 0, outW, 0, outW, outH, 0, outH];
  const H = computeHomography(src, dst);
  const Hinv = invertH(H);
  const result = new Uint8ClampedArray(outW * outH * 4);

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const w = Hinv[6]*dx + Hinv[7]*dy + Hinv[8];
      if (Math.abs(w) < 1e-10) continue;
      const sx = (Hinv[0]*dx + Hinv[1]*dy + Hinv[2]) / w;
      const sy = (Hinv[3]*dx + Hinv[4]*dy + Hinv[5]) / w;
      if (sx < 0 || sy < 0 || sx >= srcW - 1 || sy >= srcH - 1) continue;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0*srcW+x0)*4, i10 = i00+4, i01 = ((y0+1)*srcW+x0)*4, i11 = i01+4;
      const di = (dy*outW+dx)*4;
      for (let c = 0; c < 4; c++) {
        result[di+c] = Math.round(
          srcPixels[i00+c]*(1-fx)*(1-fy) + srcPixels[i10+c]*fx*(1-fy) +
          srcPixels[i01+c]*(1-fx)*fy + srcPixels[i11+c]*fx*fy
        );
      }
    }
  }

  return result;
}

// ─── Filter presets (simplified for worker) ───

function applyFilterInPlace(d: Uint8ClampedArray, w: number, h: number, preset: string) {
  if (preset === "original") return;

  if (preset === "photo") {
    // Slight contrast
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++)
        d[i+c] = Math.min(255, Math.max(0, Math.round((d[i+c]-128)*1.15+128)));
    }
    return;
  }

  if (preset === "document") {
    // Background lighten + text enhance
    for (let i = 0; i < d.length; i += 4) {
      const lum = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
      if (lum > 160) {
        const blend = Math.min((lum-160)/60, 1) * 0.6;
        for (let c = 0; c < 3; c++) d[i+c] = Math.min(255, d[i+c] + (255-d[i+c])*blend);
      } else {
        const f = Math.max(0.7, 1-(160-lum)/400);
        for (let c = 0; c < 3; c++) d[i+c] = Math.round(d[i+c]*f);
      }
    }
    // Contrast boost
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++)
        d[i+c] = Math.min(255, Math.max(0, Math.round((d[i+c]-128)*1.1+128)));
    }
    return;
  }

  if (preset === "bw") {
    // Adaptive threshold
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w*h; i++)
      gray[i] = Math.round(d[i*4]*0.299 + d[i*4+1]*0.587 + d[i*4+2]*0.114);

    const blockSize = Math.max(15, Math.round(Math.min(w,h)/30)|1);
    const half = Math.floor(blockSize/2);
    const integral = new Float64Array((w+1)*(h+1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += gray[y*w+x];
        integral[(y+1)*(w+1)+(x+1)] = rowSum + integral[y*(w+1)+(x+1)];
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1=Math.max(0,x-half), y1=Math.max(0,y-half);
        const x2=Math.min(w-1,x+half), y2=Math.min(h-1,y+half);
        const count=(x2-x1+1)*(y2-y1+1);
        const sum = integral[(y2+1)*(w+1)+(x2+1)] - integral[y1*(w+1)+(x2+1)]
                  - integral[(y2+1)*(w+1)+x1] + integral[y1*(w+1)+x1];
        const val = gray[y*w+x] < sum/count - 10 ? 0 : 255;
        const idx = (y*w+x)*4;
        d[idx] = d[idx+1] = d[idx+2] = val;
      }
    }
    return;
  }

  if (preset === "enhanced") {
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[i+c] / 255;
        v = Math.pow(v, 0.85);
        v = (v - 0.5) * 1.2 + 0.5;
        d[i+c] = Math.min(255, Math.max(0, Math.round(v * 255)));
      }
    }
  }
}

// ─── Worker message handler ───

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === "detect") {
    const { imageData, width, height } = msg;
    const gray = toGrayscale(imageData, width, height);
    const blurred = gaussianBlur5x5(gray, width, height);
    const { magnitude, direction } = sobelEdges(blurred, width, height);
    const threshold = otsuThreshold(magnitude);
    const nms = nonMaxSuppression(magnitude, direction, width, height);
    // Lower hysteresis thresholds for better sensitivity
    const lowT = Math.max(threshold * 0.3, 15);
    const highT = Math.max(threshold * 0.7, 40);
    const edges = hysteresis(nms, width, height, lowT, highT);
    const quadPoints = findLargestQuadContour(edges, width, height);

    if (quadPoints) {
      const quad = orderQuad(quadPoints);
      const conf = confidenceScore(quad, width, height);
      ctx.postMessage({ type: "detect", quad, confidence: conf });
    } else {
      ctx.postMessage({ type: "detect", quad: null, confidence: 0 });
    }
  }

  else if (msg.type === "warp") {
    const { imageData, width, height, quad, maxDim } = msg;
    const size = computeOutputSize(quad, maxDim || 2048);
    const warped = warpPerspective(imageData, width, height, quad, size.w, size.h);
    ctx.postMessage(
      { type: "warp", imageData: warped, width: size.w, height: size.h },
      [warped.buffer] as any
    );
  }

  else if (msg.type === "filter") {
    const { imageData, width, height, preset } = msg;
    const copy = new Uint8ClampedArray(imageData);
    applyFilterInPlace(copy, width, height, preset);
    ctx.postMessage(
      { type: "filter", imageData: copy, width, height },
      [copy.buffer] as any
    );
  }
};
