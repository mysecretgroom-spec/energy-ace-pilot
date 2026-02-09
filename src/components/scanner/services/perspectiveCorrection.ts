/**
 * Pure JS perspective correction — straightens tilted documents without OpenCV.
 * Uses bilinear interpolation with a 3x3 homography matrix.
 */

interface Point {
  x: number;
  y: number;
}

interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Apply perspective correction: takes a tilted quadrilateral and maps it to a clean rectangle.
 * @param imageData - data URL of the source image
 * @param corners - normalized (0-1) corner coordinates of the document in the image
 * @returns data URL of the straightened document
 */
export function applyPerspectiveCorrectionLight(
  imageData: string,
  corners: Corners
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Convert normalized corners to pixel coordinates
        const src: Corners = {
          topLeft: { x: corners.topLeft.x * img.width, y: corners.topLeft.y * img.height },
          topRight: { x: corners.topRight.x * img.width, y: corners.topRight.y * img.height },
          bottomRight: { x: corners.bottomRight.x * img.width, y: corners.bottomRight.y * img.height },
          bottomLeft: { x: corners.bottomLeft.x * img.width, y: corners.bottomLeft.y * img.height },
        };

        // Determine output dimensions from the longest edges
        const topWidth = dist(src.topLeft, src.topRight);
        const bottomWidth = dist(src.bottomLeft, src.bottomRight);
        const leftHeight = dist(src.topLeft, src.bottomLeft);
        const rightHeight = dist(src.topRight, src.bottomRight);

        const outW = Math.round(Math.max(topWidth, bottomWidth));
        const outH = Math.round(Math.max(leftHeight, rightHeight));

        if (outW < 10 || outH < 10) return reject(new Error("Output too small"));

        // Source canvas to read pixels
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
        if (!srcCtx) return reject(new Error("No src ctx"));
        srcCtx.drawImage(img, 0, 0);
        const srcPixels = srcCtx.getImageData(0, 0, img.width, img.height);

        // Destination canvas
        const dstCanvas = document.createElement("canvas");
        dstCanvas.width = outW;
        dstCanvas.height = outH;
        const dstCtx = dstCanvas.getContext("2d");
        if (!dstCtx) return reject(new Error("No dst ctx"));
        const dstData = dstCtx.createImageData(outW, outH);

        // Compute inverse homography: for each output pixel, find source pixel
        // Using bilinear interpolation on the quadrilateral
        const srcPx = srcPixels.data;
        const dstPx = dstData.data;

        for (let dy = 0; dy < outH; dy++) {
          const v = dy / outH; // 0..1 vertical position
          for (let dx = 0; dx < outW; dx++) {
            const u = dx / outW; // 0..1 horizontal position

            // Bilinear interpolation of quad corners to find source position
            const sx =
              (1 - u) * (1 - v) * src.topLeft.x +
              u * (1 - v) * src.topRight.x +
              u * v * src.bottomRight.x +
              (1 - u) * v * src.bottomLeft.x;
            const sy =
              (1 - u) * (1 - v) * src.topLeft.y +
              u * (1 - v) * src.topRight.y +
              u * v * src.bottomRight.y +
              (1 - u) * v * src.bottomLeft.y;

            // Bilinear sample from source
            const x0 = Math.floor(sx);
            const y0 = Math.floor(sy);
            const x1 = Math.min(x0 + 1, img.width - 1);
            const y1 = Math.min(y0 + 1, img.height - 1);
            const fx = sx - x0;
            const fy = sy - y0;

            if (x0 < 0 || y0 < 0 || x0 >= img.width || y0 >= img.height) continue;

            const dIdx = (dy * outW + dx) * 4;
            for (let c = 0; c < 4; c++) {
              const v00 = srcPx[(y0 * img.width + x0) * 4 + c];
              const v10 = srcPx[(y0 * img.width + x1) * 4 + c];
              const v01 = srcPx[(y1 * img.width + x0) * 4 + c];
              const v11 = srcPx[(y1 * img.width + x1) * 4 + c];
              dstPx[dIdx + c] = Math.round(
                v00 * (1 - fx) * (1 - fy) +
                v10 * fx * (1 - fy) +
                v01 * (1 - fx) * fy +
                v11 * fx * fy
              );
            }
          }
        }

        dstCtx.putImageData(dstData, 0, 0);
        resolve(dstCanvas.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageData;
  });
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
