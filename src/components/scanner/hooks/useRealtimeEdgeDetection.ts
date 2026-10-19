import { useRef, useCallback, useState, useEffect } from "react";

interface Point {
  x: number;
  y: number;
}

export interface DetectedQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

interface UseRealtimeEdgeDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onStableDetection?: (quad: DetectedQuad) => void;
}

// ---- Lightweight Canny+Hough pipeline (runs on small frames) ----

function gaussianBlur3(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const k = [1,2,1, 2,4,2, 1,2,1]; // sum=16
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0, ki = 0;
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++)
          s += src[(y+ky)*w+(x+kx)] * k[ki++];
      out[y*w+x] = s >> 4;
    }
  }
  return out;
}

function sobelGradient(src: Uint8Array, w: number, h: number) {
  const mag = new Uint8Array(w * h);
  const dir = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y*w+x;
      const gx =
        -src[(y-1)*w+x-1] - 2*src[y*w+x-1] - src[(y+1)*w+x-1] +
         src[(y-1)*w+x+1] + 2*src[y*w+x+1] + src[(y+1)*w+x+1];
      const gy =
        -src[(y-1)*w+x-1] - 2*src[(y-1)*w+x] - src[(y-1)*w+x+1] +
         src[(y+1)*w+x-1] + 2*src[(y+1)*w+x] + src[(y+1)*w+x+1];
      const m = Math.sqrt(gx*gx + gy*gy);
      mag[idx] = m > 255 ? 255 : m | 0;
      dir[idx] = Math.atan2(gy, gx);
    }
  }
  return { mag, dir };
}

function cannyNMS(mag: Uint8Array, dir: Float32Array, w: number, h: number, lo: number, hi: number): Uint8Array {
  const nms = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y*w+x;
      const m = mag[idx];
      if (m < lo) continue;
      const a = ((dir[idx] * 180 / Math.PI) + 180) % 180;
      let n1 = 0, n2 = 0;
      if (a < 22.5 || a >= 157.5) { n1 = mag[idx-1]; n2 = mag[idx+1]; }
      else if (a < 67.5) { n1 = mag[(y-1)*w+x+1]; n2 = mag[(y+1)*w+x-1]; }
      else if (a < 112.5) { n1 = mag[(y-1)*w+x]; n2 = mag[(y+1)*w+x]; }
      else { n1 = mag[(y-1)*w+x-1]; n2 = mag[(y+1)*w+x+1]; }
      nms[idx] = m >= n1 && m >= n2 ? m : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y*w+x;
      if (nms[idx] >= hi) out[idx] = 255;
      else if (nms[idx] >= lo) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (nms[(y+dy)*w+x+dx] >= hi) { out[idx] = 255; break; }
      }
    }
  }
  return out;
}

interface HoughLine { rho: number; theta: number; votes: number }

function houghLines(edges: Uint8Array, w: number, h: number): HoughLine[] {
  const thetaSteps = 180;
  const dTheta = Math.PI / thetaSteps;
  const maxRho = Math.sqrt(w*w + h*h) | 0;
  const rhoSteps = maxRho * 2 + 1;
  const acc = new Int32Array(thetaSteps * rhoSteps);

  const cosT = new Float32Array(thetaSteps);
  const sinT = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t++) {
    cosT[t] = Math.cos(t * dTheta);
    sinT[t] = Math.sin(t * dTheta);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edges[y*w+x] === 0) continue;
      for (let t = 0; t < thetaSteps; t++) {
        const rho = Math.round(x * cosT[t] + y * sinT[t]) + maxRho;
        acc[t * rhoSteps + rho]++;
      }
    }
  }

  const minVotes = Math.max(w, h) * 0.12;
  const lines: HoughLine[] = [];
  const nmsR = 4;
  for (let t = 0; t < thetaSteps; t++) {
    for (let r = 0; r < rhoSteps; r++) {
      const v = acc[t * rhoSteps + r];
      if (v < minVotes) continue;
      let isMax = true;
      for (let dt = -nmsR; dt <= nmsR && isMax; dt++) {
        for (let dr = -nmsR; dr <= nmsR && isMax; dr++) {
          if (dt === 0 && dr === 0) continue;
          const nt = t + dt, nr = r + dr;
          if (nt >= 0 && nt < thetaSteps && nr >= 0 && nr < rhoSteps) {
            if (acc[nt * rhoSteps + nr] > v) isMax = false;
          }
        }
      }
      if (isMax) lines.push({ rho: r - maxRho, theta: t * dTheta, votes: v });
    }
  }
  lines.sort((a, b) => b.votes - a.votes);
  return lines.slice(0, 30);
}

function lineIntersection(l1: HoughLine, l2: HoughLine): Point | null {
  const c1 = Math.cos(l1.theta), s1 = Math.sin(l1.theta);
  const c2 = Math.cos(l2.theta), s2 = Math.sin(l2.theta);
  const det = c1 * s2 - c2 * s1;
  if (Math.abs(det) < 1e-6) return null;
  return { x: (l1.rho * s2 - l2.rho * s1) / det, y: (l2.rho * c1 - l1.rho * c2) / det };
}

function quadArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function rectangularity(pts: Point[]): number {
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i+1)%4], c = pts[(i+2)%4];
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const dot = v1x*v2x + v1y*v2y;
    const m1 = Math.sqrt(v1x*v1x + v1y*v1y);
    const m2 = Math.sqrt(v2x*v2x + v2y*v2y);
    if (m1 < 1 || m2 < 1) return 0;
    angles.push(Math.abs(Math.acos(Math.max(-1, Math.min(1, dot/(m1*m2)))) - Math.PI/2));
  }
  return Math.max(0, 1 - angles.reduce((s, a) => s + a, 0) / 4 / (Math.PI/4));
}

function sortCorners(pts: Point[]): { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point } {
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return { topLeft: sorted[0], topRight: sorted[1], bottomRight: sorted[2], bottomLeft: sorted[3] };
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = Math.PI * 2 - d;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

function detectQuadFromEdges(edges: Uint8Array, w: number, h: number): DetectedQuad | null {
  const lines = houghLines(edges, w, h);
  if (lines.length < 4) return null;

  const horizontal: HoughLine[] = [];
  const vertical: HoughLine[] = [];
  const margin = Math.PI / 4;

  for (const line of lines) {
    const a = line.theta % Math.PI;
    if (a < margin || a > Math.PI - margin) vertical.push(line);
    else if (a > Math.PI / 2 - margin && a < Math.PI / 2 + margin) horizontal.push(line);
  }

  if (horizontal.length < 2 || vertical.length < 2) return null;

  let bestQuad: Point[] | null = null;
  let bestScore = 0;
  const hMax = Math.min(horizontal.length, 5);
  const vMax = Math.min(vertical.length, 5);

  for (let hi = 0; hi < hMax; hi++) {
    for (let hj = hi + 1; hj < hMax; hj++) {
      for (let vi = 0; vi < vMax; vi++) {
        for (let vj = vi + 1; vj < vMax; vj++) {
          const corners = [
            lineIntersection(horizontal[hi], vertical[vi]),
            lineIntersection(horizontal[hi], vertical[vj]),
            lineIntersection(horizontal[hj], vertical[vj]),
            lineIntersection(horizontal[hj], vertical[vi]),
          ];
          if (corners.some(c => !c)) continue;
          const pts = corners as Point[];
          const m = -w * 0.05;
          if (pts.some(p => p.x < m || p.y < m || p.x > w - m || p.y > h - m)) continue;

          const area = quadArea(pts);
          const imgArea = w * h;
          if (area < imgArea * 0.15 || area > imgArea * 0.95) continue;

          const votes = horizontal[hi].votes + horizontal[hj].votes + vertical[vi].votes + vertical[vj].votes;
          const rect = rectangularity(pts);
          // Require minimum rectangularity to reject non-document shapes
          if (rect < 0.6) continue;
          const areaRatio = area / imgArea;
          const score = areaRatio * areaRatio * votes * rect;

          if (score > bestScore) {
            bestScore = score;
            bestQuad = pts;
          }
        }
      }
    }
  }

  if (!bestQuad) return null;

  const area = quadArea(bestQuad);
  const imgArea = w * h;
  const areaRatio = area / imgArea;
  const rect = rectangularity(bestQuad);
  // Confidence based on area coverage + rectangularity
  const confidence = Math.min(1, areaRatio * rect * 1.5);
  if (confidence < 0.25) return null;

  const sorted = sortCorners(bestQuad);
  return { ...sorted, confidence };
}

// ---- Blur detection (Laplacian variance) ----

export function computeBlurScore(gray: Uint8Array, w: number, h: number): number {
  // Laplacian kernel: 0 1 0 / 1 -4 1 / 0 1 0
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap = -4 * gray[y*w+x] + gray[(y-1)*w+x] + gray[(y+1)*w+x] + gray[y*w+x-1] + gray[y*w+x+1];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return (sumSq / count) - (mean * mean); // variance
}

// ---- Brightness detection ----

export function computeBrightness(gray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

// ---- Aspect ratio check for common document formats ----

function isDocumentAspectRatio(quad: DetectedQuad): boolean {
  const topW = Math.sqrt(
    (quad.topRight.x - quad.topLeft.x) ** 2 + (quad.topRight.y - quad.topLeft.y) ** 2
  );
  const leftH = Math.sqrt(
    (quad.bottomLeft.x - quad.topLeft.x) ** 2 + (quad.bottomLeft.y - quad.topLeft.y) ** 2
  );
  if (topW < 1 || leftH < 1) return false;
  const ratio = Math.max(topW, leftH) / Math.min(topW, leftH);
  // Accept ratios between 1.0 (square/card) and 2.0 (long receipt)
  return ratio >= 1.0 && ratio <= 2.2;
}

// ---- Main hook ----

export function useRealtimeEdgeDetection({
  videoRef,
  enabled,
  onStableDetection,
}: UseRealtimeEdgeDetectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const lastQuadRef = useRef<DetectedQuad | null>(null);
  const stableCallbackFiredRef = useRef(false);
  
  const [detectedQuad, setDetectedQuad] = useState<DetectedQuad | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [blurScore, setBlurScore] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(128);

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
    return () => { canvasRef.current = null; };
  }, []);

  const quadsAreSimilar = useCallback((q1: DetectedQuad | null, q2: DetectedQuad | null, tol: number = 15): boolean => {
    if (!q1 || !q2) return false;
    const d = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    return d(q1.topLeft, q2.topLeft) < tol && d(q1.topRight, q2.topRight) < tol &&
           d(q1.bottomRight, q2.bottomRight) < tol && d(q1.bottomLeft, q2.bottomLeft) < tol;
  }, []);

  const processFrame = useCallback(() => {
    if (!enabled || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const canvas = canvasRef.current;
    // Process at ~200px for speed (Canny+Hough is heavier than old Sobel)
    const scale = Math.min(200 / video.videoWidth, 200 / video.videoHeight, 0.2);
    const w = Math.max(50, Math.floor(video.videoWidth * scale));
    const h = Math.max(50, Math.floor(video.videoHeight * scale));

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const px = imageData.data;

    // 1. Grayscale
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = (px[p] * 77 + px[p+1] * 150 + px[p+2] * 29) >> 8;
    }

    // 2. Blur & brightness metrics
    const blur = computeBlurScore(gray, w, h);
    const bright = computeBrightness(gray);
    setBlurScore(blur);
    setBrightness(bright);

    // 3. Gaussian blur → Sobel → Canny
    const blurred = gaussianBlur3(gray, w, h);
    const { mag, dir } = sobelGradient(blurred, w, h);
    const edges = cannyNMS(mag, dir, w, h, 20, 60);

    // 4. Hough quad detection
    const quad = detectQuadFromEdges(edges, w, h);

    if (quad) {
      // Scale back to video coordinates
      const sx = video.videoWidth / w;
      const sy = video.videoHeight / h;
      const scaledQuad: DetectedQuad = {
        topLeft: { x: quad.topLeft.x * sx, y: quad.topLeft.y * sy },
        topRight: { x: quad.topRight.x * sx, y: quad.topRight.y * sy },
        bottomRight: { x: quad.bottomRight.x * sx, y: quad.bottomRight.y * sy },
        bottomLeft: { x: quad.bottomLeft.x * sx, y: quad.bottomLeft.y * sy },
        confidence: quad.confidence,
      };

      // Additional validation: aspect ratio check
      if (!isDocumentAspectRatio(scaledQuad)) {
        setDetectedQuad(null);
        stableCountRef.current = 0;
        setIsStable(false);
        lastQuadRef.current = null;
        stableCallbackFiredRef.current = false;
        return;
      }

      setDetectedQuad(scaledQuad);

      if (quadsAreSimilar(scaledQuad, lastQuadRef.current)) {
        stableCountRef.current++;
        // Require ~2.5s stability at ~4fps = ~10 frames (less aggressive auto-capture)
        if (stableCountRef.current >= 10 && !stableCallbackFiredRef.current) {
          setIsStable(true);
          stableCallbackFiredRef.current = true;
          onStableDetection?.(scaledQuad);
        }
      } else {
        stableCountRef.current = 0;
        setIsStable(false);
        stableCallbackFiredRef.current = false;
      }
      lastQuadRef.current = scaledQuad;
    } else {
      setDetectedQuad(null);
      stableCountRef.current = 0;
      setIsStable(false);
      lastQuadRef.current = null;
      stableCallbackFiredRef.current = false;
    }
  }, [enabled, videoRef, quadsAreSimilar, onStableDetection]);

  // Run at ~4fps via setInterval (lighter than rAF)
  useEffect(() => {
    if (enabled) {
      processFrame(); // initial
      intervalRef.current = window.setInterval(processFrame, 250);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, processFrame]);

  const reset = useCallback(() => {
    stableCountRef.current = 0;
    lastQuadRef.current = null;
    stableCallbackFiredRef.current = false;
    setDetectedQuad(null);
    setIsStable(false);
  }, []);

  return {
    detectedQuad,
    isStable,
    blurScore,
    brightness,
    reset,
  };
}
