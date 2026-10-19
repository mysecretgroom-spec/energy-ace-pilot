/**
 * Fold-line detection for unfolded multi-page documents.
 * Detects vertical or horizontal fold lines inside a document quad,
 * then splits it into sub-pages.
 */

interface Point { x: number; y: number }

export interface FoldLine {
  /** Normalized position along the relevant axis (0–1) */
  position: number;
  /** "vertical" = splits left/right, "horizontal" = splits top/bottom */
  direction: "vertical" | "horizontal";
  confidence: number;
}

export interface DetectedFolds {
  lines: FoldLine[];
  /** Sub-quads in normalized coords (0–1 relative to original image) */
  subQuads: Array<{
    topLeft: Point;
    topRight: Point;
    bottomRight: Point;
    bottomLeft: Point;
  }>;
}

/**
 * Detect fold lines inside the document region.
 * Uses a gradient-based approach: fold lines create a strong vertical
 * or horizontal crease visible as a dark line.
 */
export async function detectFoldLines(
  imageData: string,
  cropNormalized?: {
    topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point;
  }
): Promise<DetectedFolds | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 4000);

    const img = new Image();
    img.onload = () => {
      try {
        const w = img.width;
        const h = img.height;

        // Work within the crop region (or full image)
        const crop = cropNormalized || {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 1, y: 0 },
          bottomRight: { x: 1, y: 1 },
          bottomLeft: { x: 0, y: 1 },
        };

        // Extract the cropped region into a canvas
        const minX = Math.round(Math.min(crop.topLeft.x, crop.bottomLeft.x) * w);
        const maxX = Math.round(Math.max(crop.topRight.x, crop.bottomRight.x) * w);
        const minY = Math.round(Math.min(crop.topLeft.y, crop.topRight.y) * h);
        const maxY = Math.round(Math.max(crop.bottomLeft.y, crop.bottomRight.y) * h);

        const cw = maxX - minX;
        const ch = maxY - minY;
        if (cw < 50 || ch < 50) { clearTimeout(timeout); resolve(null); return; }

        // Downscale for speed
        const maxDim = 500;
        const scale = Math.min(maxDim / cw, maxDim / ch, 1);
        const sw = Math.round(cw * scale);
        const sh = Math.round(ch * scale);

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { clearTimeout(timeout); resolve(null); return; }

        ctx.drawImage(img, minX, minY, cw, ch, 0, 0, sw, sh);
        const px = ctx.getImageData(0, 0, sw, sh).data;

        // Grayscale
        const gray = new Uint8Array(sw * sh);
        for (let i = 0; i < gray.length; i++) {
          const p = i * 4;
          gray[i] = (px[p] * 77 + px[p + 1] * 150 + px[p + 2] * 29) >> 8;
        }

        const folds: FoldLine[] = [];

        // Detect vertical fold lines (creases running top to bottom)
        const vFolds = detectVerticalFolds(gray, sw, sh);
        for (const vf of vFolds) {
          folds.push({
            position: vf.x / sw,
            direction: "vertical",
            confidence: vf.confidence,
          });
        }

        // Detect horizontal fold lines (creases running left to right)
        const hFolds = detectHorizontalFolds(gray, sw, sh);
        for (const hf of hFolds) {
          folds.push({
            position: hf.y / sh,
            direction: "horizontal",
            confidence: hf.confidence,
          });
        }

        const splitFold = selectSplitFold(folds);
        if (!splitFold) {
          clearTimeout(timeout);
          resolve(null);
          return;
        }

        // Un seul pli central fiable → 2 pages (livret / feuille pliée).
        // Les froissures d'un ticket ne doivent jamais découper en dizaines de bandes.
        const subQuads = buildSubQuads(crop, [splitFold]);

        clearTimeout(timeout);
        resolve({ lines: folds, subQuads });
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = imageData;
  });
}

interface FoldCandidate {
  x: number;
  confidence: number;
}

interface HFoldCandidate {
  y: number;
  confidence: number;
}

/**
 * Detect vertical fold lines by looking at column-wise gradient variance.
 * A fold line creates a consistent dark stripe or intensity discontinuity.
 */
function detectVerticalFolds(gray: Uint8Array, w: number, h: number): FoldCandidate[] {
  // For each column x, compute average horizontal gradient magnitude
  const margin = Math.round(w * 0.1); // ignore edges
  const colScores = new Float32Array(w);

  for (let x = margin; x < w - margin; x++) {
    let totalGrad = 0;
    let count = 0;
    for (let y = Math.round(h * 0.1); y < Math.round(h * 0.9); y++) {
      const idx = y * w + x;
      // Horizontal gradient (difference between left and right)
      if (x > 0 && x < w - 1) {
        const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
        totalGrad += gx;
        count++;
      }
    }
    colScores[x] = count > 0 ? totalGrad / count : 0;
  }

  // Also look at column intensity dips (dark creases)
  const colIntensity = new Float32Array(w);
  for (let x = margin; x < w - margin; x++) {
    let total = 0;
    let count = 0;
    for (let y = Math.round(h * 0.1); y < Math.round(h * 0.9); y++) {
      total += gray[y * w + x];
      count++;
    }
    colIntensity[x] = count > 0 ? total / count : 128;
  }

  // Find peaks in gradient + intensity dips
  const candidates: FoldCandidate[] = [];
  const windowSize = Math.round(w * 0.05);
  const minSeparation = Math.round(w * 0.15); // folds can't be too close together

  // Compute average gradient for normalization
  let avgGrad = 0;
  let gradCount = 0;
  for (let x = margin; x < w - margin; x++) {
    avgGrad += colScores[x];
    gradCount++;
  }
  avgGrad /= gradCount || 1;

  // Look for columns that have significantly higher gradient than surroundings
  for (let x = margin + windowSize; x < w - margin - windowSize; x++) {
    const localScore = colScores[x];

    // Compare to surrounding area
    let surroundAvg = 0;
    let sCount = 0;
    for (let dx = -windowSize; dx <= windowSize; dx++) {
      if (Math.abs(dx) > 3) {
        surroundAvg += colScores[x + dx];
        sCount++;
      }
    }
    surroundAvg /= sCount || 1;

    // Also check for intensity dip
    let surroundIntensity = 0;
    let siCount = 0;
    for (let dx = -windowSize; dx <= windowSize; dx++) {
      if (Math.abs(dx) > 3) {
        surroundIntensity += colIntensity[x + dx];
        siCount++;
      }
    }
    surroundIntensity /= siCount || 1;
    const intensityDip = (surroundIntensity - colIntensity[x]) / (surroundIntensity || 1);

    // Score: gradient peak + intensity dip
    const gradRatio = localScore / (surroundAvg || 1);
    const confidence = Math.min(1, (gradRatio - 1) * 0.5 + Math.max(0, intensityDip) * 2);

    if (confidence > 0.25 && localScore > avgGrad * 1.3) {
      candidates.push({ x, confidence });
    }
  }

  // NMS: keep strongest candidates with minimum separation
  candidates.sort((a, b) => b.confidence - a.confidence);
  const result: FoldCandidate[] = [];
  for (const c of candidates) {
    if (result.every(r => Math.abs(r.x - c.x) >= minSeparation)) {
      result.push(c);
    }
  }

  return result;
}

/**
 * Same approach for horizontal folds.
 */
function detectHorizontalFolds(gray: Uint8Array, w: number, h: number): HFoldCandidate[] {
  const margin = Math.round(h * 0.1);
  const rowScores = new Float32Array(h);

  for (let y = margin; y < h - margin; y++) {
    let totalGrad = 0;
    let count = 0;
    for (let x = Math.round(w * 0.1); x < Math.round(w * 0.9); x++) {
      const idx = y * w + x;
      if (y > 0 && y < h - 1) {
        const gy = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
        totalGrad += gy;
        count++;
      }
    }
    rowScores[y] = count > 0 ? totalGrad / count : 0;
  }

  const rowIntensity = new Float32Array(h);
  for (let y = margin; y < h - margin; y++) {
    let total = 0;
    let count = 0;
    for (let x = Math.round(w * 0.1); x < Math.round(w * 0.9); x++) {
      total += gray[y * w + x];
      count++;
    }
    rowIntensity[y] = count > 0 ? total / count : 128;
  }

  const candidates: HFoldCandidate[] = [];
  const windowSize = Math.round(h * 0.05);
  const minSeparation = Math.round(h * 0.15);

  let avgGrad = 0;
  let gradCount = 0;
  for (let y = margin; y < h - margin; y++) {
    avgGrad += rowScores[y];
    gradCount++;
  }
  avgGrad /= gradCount || 1;

  for (let y = margin + windowSize; y < h - margin - windowSize; y++) {
    const localScore = rowScores[y];

    let surroundAvg = 0;
    let sCount = 0;
    for (let dy = -windowSize; dy <= windowSize; dy++) {
      if (Math.abs(dy) > 3) {
        surroundAvg += rowScores[y + dy];
        sCount++;
      }
    }
    surroundAvg /= sCount || 1;

    let surroundIntensity = 0;
    let siCount = 0;
    for (let dy = -windowSize; dy <= windowSize; dy++) {
      if (Math.abs(dy) > 3) {
        surroundIntensity += rowIntensity[y + dy];
        siCount++;
      }
    }
    surroundIntensity /= siCount || 1;
    const intensityDip = (surroundIntensity - rowIntensity[y]) / (surroundIntensity || 1);

    const gradRatio = localScore / (surroundAvg || 1);
    const confidence = Math.min(1, (gradRatio - 1) * 0.5 + Math.max(0, intensityDip) * 2);

    if (confidence > 0.25 && localScore > avgGrad * 1.3) {
      candidates.push({ y, confidence });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const result: HFoldCandidate[] = [];
  for (const c of candidates) {
    if (result.every(r => Math.abs(r.y - c.y) >= minSeparation)) {
      result.push(c);
    }
  }

  return result;
}

/**
 * Given the crop quad and detected fold lines, build sub-quads.
 */
function buildSubQuads(
  crop: { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point },
  folds: FoldLine[]
): DetectedFolds["subQuads"] {
  // Separate vertical and horizontal folds, sorted by position
  const vFolds = folds.filter(f => f.direction === "vertical").sort((a, b) => a.position - b.position);
  const hFolds = folds.filter(f => f.direction === "horizontal").sort((a, b) => a.position - b.position);

  // Build column boundaries: [0, vFold1, vFold2, ..., 1]
  const xSplits = [0, ...vFolds.map(f => f.position), 1];
  // Build row boundaries: [0, hFold1, hFold2, ..., 1]
  const ySplits = [0, ...hFolds.map(f => f.position), 1];

  const quads: DetectedFolds["subQuads"] = [];

  // Interpolate points on the crop quad edges
  const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  for (let row = 0; row < ySplits.length - 1; row++) {
    for (let col = 0; col < xSplits.length - 1; col++) {
      const x0 = xSplits[col];
      const x1 = xSplits[col + 1];
      const y0 = ySplits[row];
      const y1 = ySplits[row + 1];

      // Bilinear interpolation on the crop quad
      const topEdge0 = lerp(crop.topLeft, crop.topRight, x0);
      const topEdge1 = lerp(crop.topLeft, crop.topRight, x1);
      const botEdge0 = lerp(crop.bottomLeft, crop.bottomRight, x0);
      const botEdge1 = lerp(crop.bottomLeft, crop.bottomRight, x1);

      quads.push({
        topLeft: lerp(topEdge0, botEdge0, y0),
        topRight: lerp(topEdge1, botEdge1, y0),
        bottomRight: lerp(topEdge1, botEdge1, y1),
        bottomLeft: lerp(topEdge0, botEdge0, y1),
      });
    }
  }

  return quads;
}
