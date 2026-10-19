/**
 * Document edge detection — Hough-line based approach.
 * Much more robust than contour/hull for stapled or overlapping documents.
 * Pipeline: grayscale → blur → Canny edges → Hough lines → best quad from line intersections.
 */

interface Point { x: number; y: number }

export interface LightDetectedEdges {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

// ---- Main export ----

export async function detectDocumentEdgesLight(
  imageData: string
): Promise<LightDetectedEdges | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { resolve(null); }, 6000);

    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 600;
        let w = img.width, h = img.height;
        const scale = Math.min(maxDim / w, maxDim / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { clearTimeout(timeout); resolve(null); return; }

        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;

        // 1. Grayscale
        const gray = new Uint8Array(w * h);
        for (let i = 0; i < gray.length; i++) {
          const p = i * 4;
          gray[i] = (px[p] * 77 + px[p+1] * 150 + px[p+2] * 29) >> 8;
        }

        // Paper contrast is evidence of a page; its area is not confidence.
        // Find small pages before Hough's large-background candidates.
        // Separate neutral paper from colored wood/mats before luminance masks.
        const paper = detectPaperRegion(paperLikelihood(px), w, h) ?? detectPaperRegion(gray, w, h);
        if (paper) { clearTimeout(timeout); resolve(paper); return; }

        // 2. Gaussian blur 5×5
        const blurred = gaussianBlur5(gray, w, h);

        // 3. Sobel gradient magnitude + direction
        const { mag, dir } = sobelGradient(blurred, w, h);

        // 4. Canny: NMS + hysteresis
        const edges = cannyEdges(mag, dir, w, h);

        // 5. Try Hough-line approach first (best for documents)
        const houghResult = houghQuadDetect(edges, gray, w, h);
        if (houghResult) {
          clearTimeout(timeout);
          const conf = Math.min(quadArea(houghResult) / (w * h), 1);
          if (conf > 0.02 && hasPaperContrast(gray, w, h, houghResult)) {
            const s = sortCorners(houghResult);
            resolve({
              topLeft: { x: s.topLeft.x / w, y: s.topLeft.y / h },
              topRight: { x: s.topRight.x / w, y: s.topRight.y / h },
              bottomRight: { x: s.bottomRight.x / w, y: s.bottomRight.y / h },
              bottomLeft: { x: s.bottomLeft.x / w, y: s.bottomLeft.y / h },
              confidence: Math.min(0.85, 0.5 + conf * 0.35),
            });
            return;
          }
        }

        // 6. Fallback: contour/hull approach
        const dilated = dilate(edges, w, h, 2);
        const hullResult = findLargestQuadHull(dilated, w, h);
        if (hullResult) {
          const conf = Math.min(quadArea(hullResult) / (w * h), 1);
          if (conf > 0.02 && hasPaperContrast(gray, w, h, hullResult)) {
            clearTimeout(timeout);
            const s = sortCorners(hullResult);
            resolve({
              topLeft: { x: s.topLeft.x / w, y: s.topLeft.y / h },
              topRight: { x: s.topRight.x / w, y: s.topRight.y / h },
              bottomRight: { x: s.bottomRight.x / w, y: s.bottomRight.y / h },
              bottomLeft: { x: s.bottomLeft.x / w, y: s.bottomLeft.y / h },
              confidence: Math.min(0.75, 0.4 + conf * 0.35),
            });
            return;
          }
        }

        clearTimeout(timeout);
        resolve(null);
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = imageData;
  });
}

// ---- Image processing ----

/** Color is used only for detection; the exported image remains untouched. */
export function paperLikelihood(rgba: Uint8ClampedArray): Uint8Array {
  const likelihood = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < likelihood.length; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const luminance = (r * 77 + g * 150 + b * 29) / 256;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    likelihood[i] = Math.max(0, Math.round(luminance - chroma * 1.4));
  }
  return likelihood;
}

/** Contrast-based page proposal. Text holes are retained in the source;
 * only a low-resolution mask is used to estimate a convex page boundary. */
export function detectPaperRegion(gray: Uint8Array, w: number, h: number, level?: number): LightDetectedEdges | null {
  if (w < 8 || h < 8 || gray.length !== w * h) return null;
  const blurred = gaussianBlur5(gray, w, h);
  if (level === undefined) {
    const base = Math.max(55, otsu(blurred));
    // Multiple masks keep a darker page from merging with upholstery or
    // a colored border; select shape evidence, not the largest component.
    const candidates = [base, base + 25, base + 50].map(t => detectPaperRegion(gray, w, h, t));
    return candidates.filter((c): c is LightDetectedEdges => c !== null)
      .sort((a,b) => b.confidence - a.confidence)[0] ?? null;
  }
  const threshold = level;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let best: LightDetectedEdges | null = null;
  let bestScore = 0;
  for (let start = 0; start < gray.length; start++) {
    if (visited[start] || blurred[start] <= threshold) continue;
    let head = 0, tail = 1;
    queue[0] = start; visited[start] = 1;
    const boundary: Point[] = [];
    const touched = { top: false, right: false, bottom: false, left: false };
    while (head < tail) {
      const index = queue[head++], x = index % w, y = Math.floor(index / w);
      if (x < 3) touched.left = true;
      if (y < 3) touched.top = true;
      if (x >= w - 3) touched.right = true;
      if (y >= h - 3) touched.bottom = true;
      let edge = false;
      for (const [nx, ny] of [[x-1,y], [x+1,y], [x,y-1], [x,y+1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { edge = true; continue; }
        const next = ny * w + nx;
        if (blurred[next] <= threshold) { edge = true; continue; }
        if (!visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (edge) boundary.push({ x, y });
    }
    // A small receipt/page is valid; frame-connected background is not.
    // A long ticket may run past ONE frame side: accept it, that side becomes the frame.
    const touchedSides = (Object.keys(touched) as FrameSide[]).filter(k => touched[k]);
    if (touchedSides.length > 1) continue;
    const openSide = touchedSides[0];
    if (tail < w * h * 0.015 || boundary.length < 12) continue;
    const hull = convexHull(boundary);
    if (hull.length < 4) continue;
    const sorted = sortCorners(pickBestQuad(hull));
    const points = [sorted.topLeft, sorted.topRight, sorted.bottomRight, sorted.bottomLeft];
    const area = quadArea(points);
    const fill = tail / Math.max(1, area);
    const rect = rectangularity(points);
    if (fill < 0.65 || fill > 1.15 || rect < 0.65 || area < w * h * 0.02) continue;
    const contrast = paperBoundaryContrast(gray, w, h, points, openSide);
    if (contrast <= 0) continue;
    const score = Math.min(1, fill) * rect * contrast * (openSide ? 0.8 : 1);
    if (score <= bestScore) continue;
    bestScore = score;
    best = {
      topLeft: { x: sorted.topLeft.x / w, y: sorted.topLeft.y / h },
      topRight: { x: sorted.topRight.x / w, y: sorted.topRight.y / h },
      bottomRight: { x: sorted.bottomRight.x / w, y: sorted.bottomRight.y / h },
      bottomLeft: { x: sorted.bottomLeft.x / w, y: sorted.bottomLeft.y / h },
      confidence: Math.min(0.95, 0.65 + rect * 0.15 + Math.min(1, fill) * 0.15),
    };
  }
  return best;
}

function hasPaperContrast(gray: Uint8Array, w: number, h: number, points: Point[]): boolean {
  return paperBoundaryContrast(gray, w, h, points) > 0;
}

type FrameSide = "top" | "right" | "bottom" | "left";

function paperBoundaryContrast(gray: Uint8Array, w: number, h: number, points: Point[], openSide?: FrameSide): number {
  const s = sortCorners(points);
  const quad = [s.topLeft, s.topRight, s.bottomRight, s.bottomLeft];
  // Side index i joins quad[i]→quad[i+1]: 0 top, 1 right, 2 bottom, 3 left.
  const openIndex = openSide ? ["top", "right", "bottom", "left"].indexOf(openSide) : -1;
  const onFrame = (p: Point) => p.x < 3 || p.y < 3 || p.x >= w - 3 || p.y >= h - 3;
  // A frame edge is not a detected paper edge. Do not approve the desk/image hull,
  // except the corners of a single side through which a long ticket leaves the frame.
  if (quad.some((p, i) => onFrame(p) && !(openIndex >= 0 && (i === openIndex || i === (openIndex + 1) % 4)))) return 0;
  const center = { x: quad.reduce((sum, p) => sum + p.x, 0) / 4,
    y: quad.reduce((sum, p) => sum + p.y, 0) / 4 };
  const sample = (p: Point) => gray[Math.max(0, Math.min(h-1, Math.round(p.y))) * w + Math.max(0, Math.min(w-1, Math.round(p.x)))];
  const sides: number[] = [];
  let inside = 0;
  for (let i = 0; i < 4; i++) {
    if (i === openIndex) continue;
    let difference = 0;
    for (let t = 0.2; t <= 0.8; t += 0.2) {
    const a = quad[i], b = quad[(i+1)%4];
    const p = { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t };
    const inner = sample({ x: p.x + (center.x-p.x)*0.08, y: p.y + (center.y-p.y)*0.08 });
    const outer = sample({ x: p.x - (center.x-p.x)*0.08, y: p.y - (center.y-p.y)*0.08 });
    inside += inner;
    difference += inner - outer;
    }
    sides.push(difference / 4);
  }
  const mean = sides.reduce((sum, v) => sum + v, 0) / sides.length;
  // Evidence is needed on every visible side, not just a strong desk/mat boundary.
  return inside / (sides.length * 4) > 60 && mean > 12 && Math.min(...sides) > 3 ? mean : 0;
}

function gaussianBlur5(src: Uint8Array, w: number, h: number): Uint8Array {
  const k = [1,4,6,4,1, 4,16,24,16,4, 6,24,36,24,6, 4,16,24,16,4, 1,4,6,4,1];
  const out = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let s = 0, ki = 0;
      for (let ky = -2; ky <= 2; ky++)
        for (let kx = -2; kx <= 2; kx++)
          s += src[(y+ky)*w+(x+kx)] * k[ki++];
      out[y*w+x] = (s >> 8);
    }
  }
  return out;
}

function sobelGradient(src: Uint8Array, w: number, h: number) {
  const mag = new Uint8Array(w * h);
  const dir = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -src[(y-1)*w+x-1] - 2*src[y*w+x-1] - src[(y+1)*w+x-1] +
         src[(y-1)*w+x+1] + 2*src[y*w+x+1] + src[(y+1)*w+x+1];
      const gy =
        -src[(y-1)*w+x-1] - 2*src[(y-1)*w+x] - src[(y-1)*w+x+1] +
         src[(y+1)*w+x-1] + 2*src[(y+1)*w+x] + src[(y+1)*w+x+1];
      const m = Math.sqrt(gx*gx + gy*gy);
      mag[y*w+x] = m > 255 ? 255 : m | 0;
      dir[y*w+x] = Math.atan2(gy, gx);
    }
  }
  return { mag, dir };
}

function cannyEdges(mag: Uint8Array, dir: Float32Array, w: number, h: number): Uint8Array {
  // NMS
  const nms = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y*w+x;
      const m = mag[idx];
      if (m < 15) continue;
      const a = ((dir[idx] * 180 / Math.PI) + 180) % 180;
      let n1 = 0, n2 = 0;
      if (a < 22.5 || a >= 157.5) { n1 = mag[idx-1]; n2 = mag[idx+1]; }
      else if (a < 67.5) { n1 = mag[(y-1)*w+x+1]; n2 = mag[(y+1)*w+x-1]; }
      else if (a < 112.5) { n1 = mag[(y-1)*w+x]; n2 = mag[(y+1)*w+x]; }
      else { n1 = mag[(y-1)*w+x-1]; n2 = mag[(y+1)*w+x+1]; }
      nms[idx] = m >= n1 && m >= n2 ? m : 0;
    }
  }

  // Otsu for thresholds
  const hi = otsu(mag) * 0.7;
  const lo = hi * 0.35;
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y*w+x;
      if (nms[idx] >= hi) { out[idx] = 255; }
      else if (nms[idx] >= lo) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (nms[(y+dy)*w+x+dx] >= hi) { out[idx] = 255; break; }
      }
    }
  }
  return out;
}

function otsu(data: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;
  const total = data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, maxV = 0, th = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sB += t * hist[t];
    const v = wB * wF * ((sB/wB) - ((sum-sB)/wF)) ** 2;
    if (v > maxV) { maxV = v; th = t; }
  }
  return th;
}

// ---- Hough line detection ----

interface HoughLine { rho: number; theta: number; votes: number }

function houghLines(edges: Uint8Array, w: number, h: number): HoughLine[] {
  const thetaSteps = 180;
  const dTheta = Math.PI / thetaSteps;
  const maxRho = Math.sqrt(w*w + h*h) | 0;
  const rhoSteps = maxRho * 2 + 1;
  const acc = new Int32Array(thetaSteps * rhoSteps);

  // Pre-compute sin/cos
  const cosT = new Float32Array(thetaSteps);
  const sinT = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t++) {
    const theta = t * dTheta;
    cosT[t] = Math.cos(theta);
    sinT[t] = Math.sin(theta);
  }

  // Vote
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edges[y*w+x] === 0) continue;
      for (let t = 0; t < thetaSteps; t++) {
        const rho = Math.round(x * cosT[t] + y * sinT[t]) + maxRho;
        acc[t * rhoSteps + rho]++;
      }
    }
  }

  // Find peaks with NMS
  const minVotes = Math.max(w, h) * 0.10;
  const lines: HoughLine[] = [];
  const nmsRadius = 5;

  for (let t = 0; t < thetaSteps; t++) {
    for (let r = 0; r < rhoSteps; r++) {
      const votes = acc[t * rhoSteps + r];
      if (votes < minVotes) continue;

      // Local maximum check
      let isMax = true;
      for (let dt = -nmsRadius; dt <= nmsRadius && isMax; dt++) {
        for (let dr = -nmsRadius; dr <= nmsRadius && isMax; dr++) {
          if (dt === 0 && dr === 0) continue;
          const nt = t + dt, nr = r + dr;
          if (nt >= 0 && nt < thetaSteps && nr >= 0 && nr < rhoSteps) {
            if (acc[nt * rhoSteps + nr] > votes) isMax = false;
          }
        }
      }

      if (isMax) {
        lines.push({ rho: r - maxRho, theta: t * dTheta, votes });
      }
    }
  }

  // Sort by votes descending
  lines.sort((a, b) => b.votes - a.votes);
  return lines.slice(0, 40); // keep top 40
}

function lineIntersection(l1: HoughLine, l2: HoughLine): Point | null {
  const c1 = Math.cos(l1.theta), s1 = Math.sin(l1.theta);
  const c2 = Math.cos(l2.theta), s2 = Math.sin(l2.theta);
  const det = c1 * s2 - c2 * s1;
  if (Math.abs(det) < 1e-6) return null; // parallel
  return {
    x: (l1.rho * s2 - l2.rho * s1) / det,
    y: (l2.rho * c1 - l1.rho * c2) / det,
  };
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = Math.PI * 2 - d;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

function houghQuadDetect(edges: Uint8Array, gray: Uint8Array, w: number, h: number): Point[] | null {
  const lines = houghLines(edges, w, h);
  if (lines.length < 4) return null;

  // Classify lines into roughly horizontal and roughly vertical
  const horizontal: HoughLine[] = [];
  const vertical: HoughLine[] = [];
  const margin = Math.PI / 4; // 45° threshold

  for (const line of lines) {
    // theta near 0 or PI means vertical line, near PI/2 means horizontal
    const a = line.theta % Math.PI;
    if (a < margin || a > Math.PI - margin) {
      vertical.push(line);
    } else if (a > Math.PI / 2 - margin && a < Math.PI / 2 + margin) {
      horizontal.push(line);
    }
  }

  if (horizontal.length < 2 || vertical.length < 2) {
    // Try arbitrary angle classification: find two dominant angle clusters
    return houghQuadFromClusters(lines, gray, w, h);
  }

  // Try all combinations of 2 horizontal + 2 vertical lines
  let bestQuad: Point[] | null = null;
  let bestScore = 0;

  const hMax = Math.min(horizontal.length, 6);
  const vMax = Math.min(vertical.length, 6);

  for (let hi = 0; hi < hMax; hi++) {
    for (let hj = hi + 1; hj < hMax; hj++) {
      for (let vi = 0; vi < vMax; vi++) {
        for (let vj = vi + 1; vj < vMax; vj++) {
          const h1 = horizontal[hi], h2 = horizontal[hj];
          const v1 = vertical[vi], v2 = vertical[vj];

          const corners = [
            lineIntersection(h1, v1),
            lineIntersection(h1, v2),
            lineIntersection(h2, v2),
            lineIntersection(h2, v1),
          ];

          if (corners.some(c => !c)) continue;
          const pts = corners as Point[];

          // Check all corners are within image (with small margin)
          const m = -w * 0.05;
          if (pts.some(p => p.x < m || p.y < m || p.x > w - m || p.y > h - m)) continue;

          const area = quadArea(pts);
          const imgArea = w * h;
          if (area < imgArea * 0.02 || area > imgArea * 0.95) continue;

          // Compare boundary evidence before choosing, not after the largest wins.
          const votes = h1.votes + h2.votes + v1.votes + v2.votes;
          const rect = rectangularity(pts);
          const score = paperBoundaryContrast(gray, w, h, pts) * rect * votes / perimeter(pts);

          if (score > bestScore) {
            bestScore = score;
            bestQuad = pts;
          }
        }
      }
    }
  }

  return bestQuad;
}

/** Fallback: cluster lines by angle and find quad */
function houghQuadFromClusters(lines: HoughLine[], gray: Uint8Array, w: number, h: number): Point[] | null {
  if (lines.length < 4) return null;

  // K-means with k=2 on theta (mod PI)
  const angles = lines.map(l => l.theta % Math.PI);
  let c0 = angles[0], c1 = angles[Math.min(1, angles.length - 1)];
  // Initialize: find two most different angles
  let maxDiff = 0;
  for (let i = 0; i < Math.min(angles.length, 10); i++) {
    for (let j = i + 1; j < Math.min(angles.length, 10); j++) {
      const d = angleDiff(angles[i], angles[j]);
      if (d > maxDiff) { maxDiff = d; c0 = angles[i]; c1 = angles[j]; }
    }
  }

  // Minimum angle separation
  if (angleDiff(c0, c1) < Math.PI / 6) return null;

  // Assign lines to clusters
  const g0: HoughLine[] = [], g1: HoughLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (angleDiff(angles[i], c0) < angleDiff(angles[i], c1)) {
      g0.push(lines[i]);
    } else {
      g1.push(lines[i]);
    }
  }

  if (g0.length < 2 || g1.length < 2) return null;

  let bestQuad: Point[] | null = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(g0.length, 5); i++) {
    for (let j = i+1; j < Math.min(g0.length, 5); j++) {
      for (let k = 0; k < Math.min(g1.length, 5); k++) {
        for (let l = k+1; l < Math.min(g1.length, 5); l++) {
          const corners = [
            lineIntersection(g0[i], g1[k]),
            lineIntersection(g0[i], g1[l]),
            lineIntersection(g0[j], g1[l]),
            lineIntersection(g0[j], g1[k]),
          ];
          if (corners.some(c => !c)) continue;
          const pts = corners as Point[];

          const m = -w * 0.05;
          if (pts.some(p => p.x < m || p.y < m || p.x > w - m || p.y > h - m)) continue;

          const area = quadArea(pts);
          const imgArea = w * h;
          if (area < imgArea * 0.02 || area > imgArea * 0.95) continue;

          const votes = g0[i].votes + g0[j].votes + g1[k].votes + g1[l].votes;
          const rect = rectangularity(pts);
          const score = paperBoundaryContrast(gray, w, h, pts) * rect * votes / perimeter(pts);

          if (score > bestScore) {
            bestScore = score;
            bestQuad = pts;
          }
        }
      }
    }
  }

  return bestQuad;
}

/** How rectangular a quad is (1.0 = perfect rectangle) */
function rectangularity(pts: Point[]): number {
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i+1)%4];
    const c = pts[(i+2)%4];
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const dot = v1x*v2x + v1y*v2y;
    const m1 = Math.sqrt(v1x*v1x + v1y*v1y);
    const m2 = Math.sqrt(v2x*v2x + v2y*v2y);
    if (m1 < 1 || m2 < 1) return 0;
    angles.push(Math.abs(Math.acos(Math.max(-1, Math.min(1, dot/(m1*m2)))) - Math.PI/2));
  }
  // Average deviation from 90° — lower is better
  const avgDev = angles.reduce((s, a) => s + a, 0) / 4;
  return Math.max(0, 1 - avgDev / (Math.PI/4));
}

// ---- Fallback: Hull-based detection ----

function findLargestQuadHull(binary: Uint8Array, w: number, h: number): Point[] | null {
  const pts: Point[] = [];
  // Sample edge points (skip for speed)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (binary[y*w+x] === 255) pts.push({ x, y });
    }
  }
  if (pts.length < 20) return null;

  const hull = convexHull(pts);
  if (hull.length < 4) return null;

  let approx = hull;
  let epsilon = perimeter(hull) * 0.015;
  for (let i = 0; i < 60; i++) {
    approx = rdpSimplify(hull, epsilon);
    if (approx.length <= 4) break;
    epsilon *= 1.1;
  }

  if (approx.length === 4) return approx;
  if (approx.length > 4) return pickBestQuad(approx);
  return null;
}

// ---- Morphological ----

function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let max = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const v = src[(y+dy)*w+x+dx];
          if (v > max) max = v;
        }
      out[y*w+x] = max;
    }
  }
  return out;
}

// ---- Geometry helpers ----

function convexHull(points: Point[]): Point[] {
  let pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length > 3000) {
    const step = Math.ceil(pts.length / 3000);
    pts = pts.filter((_, i) => i % step === 0);
  }
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function perimeter(pts: Point[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    p += Math.sqrt((pts[j].x-pts[i].x)**2 + (pts[j].y-pts[i].y)**2);
  }
  return p;
}

function rdpSimplify(pts: Point[], eps: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length-1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    const l = rdpSimplify(pts.slice(0, maxI+1), eps);
    const r = rdpSimplify(pts.slice(maxI), eps);
    return l.slice(0,-1).concat(r);
  }
  return [pts[0], pts[pts.length-1]];
}

function ptLineDist(p: Point, a: Point, b: Point): number {
  const dx = b.x-a.x, dy = b.y-a.y;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.sqrt((p.x-a.x)**2 + (p.y-a.y)**2);
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq));
  return Math.sqrt((p.x-a.x-t*dx)**2 + (p.y-a.y-t*dy)**2);
}

function pickBestQuad(points: Point[]): Point[] {
  const cx = points.reduce((s,p) => s+p.x, 0) / points.length;
  const cy = points.reduce((s,p) => s+p.y, 0) / points.length;
  const qs: [Point[],Point[],Point[],Point[]] = [[],[],[],[]];
  for (const p of points) {
    qs[(p.y < cy ? 0 : 2) + (p.x < cx ? 0 : 1)].push(p);
  }
  const res: Point[] = [];
  for (const q of qs) {
    if (q.length === 0) return points.slice(0,4);
    let best = q[0], bestD = 0;
    for (const p of q) {
      const d = (p.x-cx)**2 + (p.y-cy)**2;
      if (d > bestD) { bestD = d; best = p; }
    }
    res.push(best);
  }
  return res;
}

function quadArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    a += pts[i].x*pts[j].y - pts[j].x*pts[i].y;
  }
  return Math.abs(a) / 2;
}

function sortCorners(points: Point[]) {
  const s = [...points];
  const sums = s.map(p => p.x+p.y);
  const diffs = s.map(p => p.x-p.y);
  return {
    topLeft: s[sums.indexOf(Math.min(...sums))],
    topRight: s[diffs.indexOf(Math.max(...diffs))],
    bottomRight: s[sums.indexOf(Math.max(...sums))],
    bottomLeft: s[diffs.indexOf(Math.min(...diffs))],
  };
}
