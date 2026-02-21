import type { Point, Quad, Size } from "../types";

/** Distance between two points */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Order 4 points as TL, TR, BR, BL using centroid + atan2.
 */
export function orderQuad(points: Point[]): Quad {
  if (points.length !== 4) throw new Error("orderQuad requires exactly 4 points");

  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;

  const withAngle = points.map((p) => ({
    ...p,
    angle: Math.atan2(p.y - cy, p.x - cx),
  }));

  // Sort by angle: TL(-PI..-PI/2), BL(-PI/2..0), BR(0..PI/2), TR(PI/2..PI)
  withAngle.sort((a, b) => a.angle - b.angle);

  // After sorting by angle (counter-clockwise from -PI):
  // Typically: TL, BL, BR, TR  or shifted
  // Use sum/diff heuristic for robustness:
  const sorted = [...points];
  sorted.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft = sorted[0];
  const bottomRight = sorted[3];

  sorted.sort((a, b) => (a.y - a.x) - (b.y - b.x));
  const topRight = sorted[0];
  const bottomLeft = sorted[3];

  return { topLeft, topRight, bottomRight, bottomLeft };
}

/**
 * Rescale quad coordinates from one resolution to another.
 */
export function rescaleQuad(quad: Quad, from: Size, to: Size): Quad {
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  const scale = (p: Point): Point => ({ x: p.x * sx, y: p.y * sy });
  return {
    topLeft: scale(quad.topLeft),
    topRight: scale(quad.topRight),
    bottomRight: scale(quad.bottomRight),
    bottomLeft: scale(quad.bottomLeft),
  };
}

/**
 * Compute output width/height from quad distances (never arbitrary).
 */
export function computeOutputSize(quad: Quad, maxDim = 2048): { w: number; h: number } {
  const topW = dist(quad.topLeft, quad.topRight);
  const bottomW = dist(quad.bottomLeft, quad.bottomRight);
  const leftH = dist(quad.topLeft, quad.bottomLeft);
  const rightH = dist(quad.topRight, quad.bottomRight);

  let w = Math.round(Math.max(topW, bottomW));
  let h = Math.round(Math.max(leftH, rightH));

  // Cap to maxDim
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

/**
 * Confidence score for a detected quad.
 * Returns 0..1 based on area ratio, convexity, angle quality.
 */
export function confidenceScore(quad: Quad, imageW: number, imageH: number): number {
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];

  // Area via shoelace
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  area = Math.abs(area) / 2;
  const imageArea = imageW * imageH;
  const areaRatio = area / imageArea;

  // Area should be between 5% and 98%
  const areaScore = areaRatio >= 0.05 && areaRatio <= 0.98 ? Math.min(areaRatio * 2, 1) : 0.1;

  // Angle quality: all angles should be close to 90°
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const curr = pts[i];
    const next = pts[(i + 1) % 4];
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const cross = v1.x * v2.y - v1.y * v2.x;
    const angleDeg = Math.abs(Math.atan2(cross, dot) * (180 / Math.PI));
    angles.push(angleDeg);
  }
  const avgAngleDev = angles.reduce((s, a) => s + Math.abs(a - 90), 0) / 4;
  const angleScore = Math.max(0, 1 - avgAngleDev / 45);

  // Convexity: all cross products same sign
  let convex = true;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) { convex = false; break; }
  }
  const convexScore = convex ? 1 : 0.3;

  return areaScore * 0.35 + angleScore * 0.4 + convexScore * 0.25;
}

/**
 * Default quad with 2% margin.
 */
export function defaultQuad(w: number, h: number): Quad {
  const mx = w * 0.02;
  const my = h * 0.02;
  return {
    topLeft: { x: mx, y: my },
    topRight: { x: w - mx, y: my },
    bottomRight: { x: w - mx, y: h - my },
    bottomLeft: { x: mx, y: h - my },
  };
}
