/**
 * Perspective correction with a true 3×3 projective homography.
 * Much more accurate than bilinear quad interpolation for tilted documents.
 */

interface Point { x: number; y: number }

interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

// ---- Linear algebra helpers ----

/** Solve 8×8 linear system Ax=b using Gaussian elimination with partial pivoting */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // singular
    if (maxRow !== col) { const tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp; }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  // Back-substitute
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

/**
 * Compute the 3×3 homography matrix that maps dst→src (inverse mapping).
 * dst corners are the output rectangle, src corners are the quad in the source image.
 */
function computeHomography(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): number[] | null {
  // We want H such that dst → src (for inverse mapping)
  // For each correspondence: src = H * dst
  // [ sx ]   [ h0 h1 h2 ] [ dx ]
  // [ sy ] = [ h3 h4 h5 ] [ dy ]
  // [ sw ]   [ h6 h7  1 ] [  1 ]
  // sx/sw = srcX, sy/sw = srcY
  // => srcX*(h6*dx + h7*dy + 1) = h0*dx + h1*dy + h2
  // => srcY*(h6*dx + h7*dy + 1) = h3*dx + h4*dy + h5

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const dx = dst[i].x, dy = dst[i].y;
    const sx = src[i].x, sy = src[i].y;

    A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]);
    b.push(sx);
    A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]);
    b.push(sy);
  }

  const h = solveLinearSystem(A, b);
  if (!h) return null;
  // Return h0..h7 + h8=1
  return [...h, 1];
}

/** Apply homography to a point: returns (x', y') */
function applyH(H: number[], x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-12) return [0, 0];
  return [
    (H[0] * x + H[1] * y + H[2]) / w,
    (H[3] * x + H[4] * y + H[5]) / w,
  ];
}

// ---- Main export ----

const MAX_OUTPUT_DIM = 2048; // Cap to avoid crashing on large images

export function applyPerspectiveCorrectionLight(
  imageData: string,
  corners: Corners
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const W = img.width, H = img.height;

        // Source quad in pixel coordinates
        const srcCorners: [Point, Point, Point, Point] = [
          { x: corners.topLeft.x * W, y: corners.topLeft.y * H },
          { x: corners.topRight.x * W, y: corners.topRight.y * H },
          { x: corners.bottomRight.x * W, y: corners.bottomRight.y * H },
          { x: corners.bottomLeft.x * W, y: corners.bottomLeft.y * H },
        ];

        // Output dimensions from longest edges, capped
        const d = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        let outW = Math.round(Math.max(d(srcCorners[0], srcCorners[1]), d(srcCorners[3], srcCorners[2])));
        let outH = Math.round(Math.max(d(srcCorners[0], srcCorners[3]), d(srcCorners[1], srcCorners[2])));

        if (outW < 10 || outH < 10) return reject(new Error("Output too small"));

        // Cap output to prevent crashes on mobile
        if (outW > MAX_OUTPUT_DIM || outH > MAX_OUTPUT_DIM) {
          const scale = Math.min(MAX_OUTPUT_DIM / outW, MAX_OUTPUT_DIM / outH);
          outW = Math.round(outW * scale);
          outH = Math.round(outH * scale);
        }

        // Destination rectangle corners (output image)
        const dstCorners: [Point, Point, Point, Point] = [
          { x: 0, y: 0 },
          { x: outW - 1, y: 0 },
          { x: outW - 1, y: outH - 1 },
          { x: 0, y: outH - 1 },
        ];

        // Compute inverse homography: maps dst pixel → src pixel
        const homography = computeHomography(srcCorners, dstCorners);
        if (!homography) {
          return resolve(bilinearFallback(img, srcCorners, outW, outH));
        }

        // Read source pixels
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = W; srcCanvas.height = H;
        const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
        if (!srcCtx) return reject(new Error("No source canvas context"));
        srcCtx.drawImage(img, 0, 0);
        const srcPx = srcCtx.getImageData(0, 0, W, H).data;

        // Write destination pixels
        const dstCanvas = document.createElement("canvas");
        dstCanvas.width = outW; dstCanvas.height = outH;
        const dstCtx = dstCanvas.getContext("2d");
        if (!dstCtx) return reject(new Error("No dest canvas context"));
        const dstImgData = dstCtx.createImageData(outW, outH);
        const dstPx = dstImgData.data;

        for (let dy = 0; dy < outH; dy++) {
          for (let dx = 0; dx < outW; dx++) {
            const [sx, sy] = applyH(homography, dx, dy);

            const x0 = Math.floor(sx);
            const y0 = Math.floor(sy);
            if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;

            const x1 = x0 + 1;
            const y1 = y0 + 1;
            const fx = sx - x0;
            const fy = sy - y0;

            const dIdx = (dy * outW + dx) * 4;
            const i00 = (y0 * W + x0) * 4;
            const i10 = (y0 * W + x1) * 4;
            const i01 = (y1 * W + x0) * 4;
            const i11 = (y1 * W + x1) * 4;

            const w00 = (1 - fx) * (1 - fy);
            const w10 = fx * (1 - fy);
            const w01 = (1 - fx) * fy;
            const w11 = fx * fy;

            dstPx[dIdx]     = srcPx[i00]     * w00 + srcPx[i10]     * w10 + srcPx[i01]     * w01 + srcPx[i11]     * w11;
            dstPx[dIdx + 1] = srcPx[i00 + 1] * w00 + srcPx[i10 + 1] * w10 + srcPx[i01 + 1] * w01 + srcPx[i11 + 1] * w11;
            dstPx[dIdx + 2] = srcPx[i00 + 2] * w00 + srcPx[i10 + 2] * w10 + srcPx[i01 + 2] * w01 + srcPx[i11 + 2] * w11;
            dstPx[dIdx + 3] = 255;
          }
        }

        dstCtx.putImageData(dstImgData, 0, 0);
        const result = dstCanvas.toDataURL("image/jpeg", 0.92);
        // Cleanup canvases to free memory immediately
        srcCanvas.width = 0;
        srcCanvas.height = 0;
        dstCanvas.width = 0;
        dstCanvas.height = 0;
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageData;
  });
}

/** Bilinear quad fallback (old method) if homography computation fails */
function bilinearFallback(
  img: HTMLImageElement,
  src: [Point, Point, Point, Point],
  outW: number,
  outH: number
): string {
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.width; srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
  srcCtx.drawImage(img, 0, 0);
  const srcPx = srcCtx.getImageData(0, 0, img.width, img.height).data;

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = outW; dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext("2d")!;
  const dstData = dstCtx.createImageData(outW, outH);
  const dstPx = dstData.data;

  for (let dy = 0; dy < outH; dy++) {
    const v = dy / outH;
    for (let dx = 0; dx < outW; dx++) {
      const u = dx / outW;
      const sx = (1-u)*(1-v)*src[0].x + u*(1-v)*src[1].x + u*v*src[2].x + (1-u)*v*src[3].x;
      const sy = (1-u)*(1-v)*src[0].y + u*(1-v)*src[1].y + u*v*src[2].y + (1-u)*v*src[3].y;

      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= img.width - 1 || y0 >= img.height - 1) continue;
      const fx = sx - x0, fy = sy - y0;
      const dIdx = (dy * outW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        dstPx[dIdx + c] = Math.round(
          srcPx[(y0*img.width+x0)*4+c]*(1-fx)*(1-fy) +
          srcPx[(y0*img.width+x0+1)*4+c]*fx*(1-fy) +
          srcPx[((y0+1)*img.width+x0)*4+c]*(1-fx)*fy +
          srcPx[((y0+1)*img.width+x0+1)*4+c]*fx*fy
        );
      }
    }
  }
  dstCtx.putImageData(dstData, 0, 0);
  const result = dstCanvas.toDataURL("image/jpeg", 0.92);
  // Cleanup
  srcCanvas.width = 0;
  srcCanvas.height = 0;
  dstCanvas.width = 0;
  dstCanvas.height = 0;
  return result;
}
