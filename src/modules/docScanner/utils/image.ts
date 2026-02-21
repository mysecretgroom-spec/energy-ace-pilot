/**
 * Image utilities: downscale, blob conversion, thumbnail generation.
 */

/**
 * Downscale an image (canvas or ImageBitmap) so its longest side <= maxDim.
 * Returns a new canvas.
 */
export function downscale(
  source: HTMLCanvasElement | ImageBitmap,
  maxDim: number
): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;

  let w = sw;
  let h = sh;
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/**
 * Convert canvas to Blob with given MIME type and quality.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type,
      quality
    );
  });
}

/**
 * Generate a small thumbnail (max 200px) from a canvas.
 */
export function generateThumbnail(source: HTMLCanvasElement): HTMLCanvasElement {
  return downscale(source, 200);
}

/**
 * Get ImageData from a canvas.
 */
export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d")!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Create canvas from ImageData.
 */
export function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Create canvas from Uint8ClampedArray + dimensions.
 */
export function pixelsToCanvas(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Load image from URL/blob URL into a canvas.
 */
export async function loadImageToCanvas(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Release canvas memory (GPU cleanup for iOS).
 */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}
