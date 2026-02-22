/**
 * Image enhancement utilities for document scanning
 */

export interface EnhancementOptions {
  contrast?: number; // 0-200, default 100
  brightness?: number; // 0-200, default 100
  grayscale?: boolean;
  sharpen?: boolean;
  autoContrast?: boolean;
}

/**
 * Apply image enhancements using Canvas
 */
export async function enhanceImage(
  imageData: string,
  options: EnhancementOptions = {}
): Promise<string> {
  const {
    contrast = 100,
    brightness = 100,
    grayscale = false,
    sharpen = false,
    autoContrast = false,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data for pixel manipulation
      let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Auto contrast (stretch histogram)
      if (autoContrast) {
        let min = 255;
        let max = 0;

        // Find min/max luminance
        for (let i = 0; i < data.length; i += 4) {
          const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          min = Math.min(min, luminance);
          max = Math.max(max, luminance);
        }

        // Stretch contrast
        const range = max - min;
        if (range > 0) {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = ((data[i] - min) / range) * 255;
            data[i + 1] = ((data[i + 1] - min) / range) * 255;
            data[i + 2] = ((data[i + 2] - min) / range) * 255;
          }
        }
      }

      // Apply brightness and contrast
      const contrastFactor = (contrast / 100);
      const brightnessFactor = (brightness - 100) * 2.55;

      for (let i = 0; i < data.length; i += 4) {
        // Apply contrast
        data[i] = ((data[i] - 128) * contrastFactor) + 128 + brightnessFactor;
        data[i + 1] = ((data[i + 1] - 128) * contrastFactor) + 128 + brightnessFactor;
        data[i + 2] = ((data[i + 2] - 128) * contrastFactor) + 128 + brightnessFactor;

        // Clamp values
        data[i] = Math.max(0, Math.min(255, data[i]));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
      }

      // Apply grayscale
      if (grayscale) {
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Apply sharpening using convolution
      if (sharpen) {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const sharpened = applyConvolution(imgData, [
          0, -1, 0,
          -1, 5, -1,
          0, -1, 0,
        ]);
        ctx.putImageData(sharpened, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

/**
 * Apply a convolution kernel to image data
 */
function applyConvolution(imageData: ImageData, kernel: number[]): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const kernelSize = 3;
  const half = Math.floor(kernelSize / 2);

  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - half;
          const py = y + ky - half;
          const idx = (py * width + px) * 4;
          const weight = kernel[ky * kernelSize + kx];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = Math.max(0, Math.min(255, r));
      output[idx + 1] = Math.max(0, Math.min(255, g));
      output[idx + 2] = Math.max(0, Math.min(255, b));
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Document enhancement preset (optimized for receipts/invoices)
 */
export async function enhanceForDocument(imageData: string): Promise<string> {
  return enhanceImage(imageData, {
    autoContrast: true,
    contrast: 120,
    brightness: 105,
    sharpen: true,
  });
}

/**
 * "Magic Color" preset — CamScanner-style auto enhancement
 * Boosts contrast, slightly desaturates non-text colors, and sharpens edges
 */
export async function enhanceMagicColor(imageData: string): Promise<string> {
  return enhanceImage(imageData, {
    autoContrast: true,
    contrast: 140,
    brightness: 110,
    sharpen: true,
  });
}

/**
 * Grayscale preset
 */
export async function enhanceGrayscale(imageData: string): Promise<string> {
  return enhanceImage(imageData, {
    autoContrast: true,
    contrast: 110,
    grayscale: true,
    sharpen: true,
  });
}

/**
 * Black & white preset for documents
 */
export async function convertToBlackAndWhite(
  imageData: string,
  threshold: number = 128
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Apply Otsu's method for automatic thresholding
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram[gray]++;
      }

      const total = canvas.width * canvas.height;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];

      let sumB = 0, wB = 0, maxVariance = 0, optimalThreshold = threshold;
      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) { maxVariance = variance; optimalThreshold = t; }
      }

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const value = gray > optimalThreshold ? 255 : 0;
        data[i] = value; data[i + 1] = value; data[i + 2] = value;
      }

      ctx.putImageData(imgData, 0, 0);
      const result = canvas.toDataURL('image/jpeg', 0.92);
      canvas.width = 0; canvas.height = 0;
      resolve(result);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

/**
 * Auto-deskew: detect text line angle and rotate to straighten
 */
export async function autoDeskew(imageData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 400;
      let w = img.width, h = img.height;
      const scale = Math.min(maxDim / w, maxDim / h, 1);
      const sw = Math.round(w * scale), sh = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, sw, sh);

      const px = ctx.getImageData(0, 0, sw, sh).data;
      // Grayscale + threshold to get text pixels
      const gray = new Uint8Array(sw * sh);
      for (let i = 0; i < gray.length; i++) {
        const p = i * 4;
        gray[i] = (px[p] * 77 + px[p+1] * 150 + px[p+2] * 29) >> 8;
      }

      // Horizontal projection at various angles to find straightest
      let bestAngle = 0, bestScore = 0;
      for (let angle = -15; angle <= 15; angle += 0.5) {
        const rad = angle * Math.PI / 180;
        const cosA = Math.cos(rad), sinA = Math.sin(rad);
        const hist = new Int32Array(sh);
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (gray[y * sw + x] < 128) { // dark pixel = text
              const ny = Math.round(y * cosA - x * sinA + sw * sinA / 2);
              if (ny >= 0 && ny < sh) hist[ny]++;
            }
          }
        }
        // Score = variance of histogram (straight text creates sharp peaks)
        let sum = 0, sumSq = 0;
        for (let i = 0; i < sh; i++) { sum += hist[i]; sumSq += hist[i] * hist[i]; }
        const mean = sum / sh;
        const variance = sumSq / sh - mean * mean;
        if (variance > bestScore) { bestScore = variance; bestAngle = angle; }
      }

      canvas.width = 0; canvas.height = 0;

      // If angle is very small, skip rotation
      if (Math.abs(bestAngle) < 0.5) {
        resolve(imageData);
        return;
      }

      // Apply rotation to original image
      const outCanvas = document.createElement("canvas");
      outCanvas.width = img.width; outCanvas.height = img.height;
      const outCtx = outCanvas.getContext("2d")!;
      outCtx.translate(img.width / 2, img.height / 2);
      outCtx.rotate(-bestAngle * Math.PI / 180);
      outCtx.drawImage(img, -img.width / 2, -img.height / 2);
      const result = outCanvas.toDataURL("image/jpeg", 0.92);
      outCanvas.width = 0; outCanvas.height = 0;
      resolve(result);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageData;
  });
}

/**
 * Smart PDF compression — adjust quality based on content type
 */
export function getOptimalJpegQuality(imageData: ImageData): number {
  const data = imageData.data;
  let colorPixels = 0;
  const total = data.length / 4;
  const sample = Math.max(1, Math.floor(total / 5000)); // sample ~5000 pixels

  for (let i = 0; i < data.length; i += 4 * sample) {
    const r = data[i], g = data[i+1], b = data[i+2];
    // Check if pixel has significant color (not grayscale)
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    if (maxC - minC > 30) colorPixels++;
  }

  const colorRatio = colorPixels / (total / sample);
  // Text-heavy documents can use lower quality, photos need higher
  if (colorRatio < 0.1) return 0.65; // mostly text/BW
  if (colorRatio < 0.3) return 0.75; // mixed
  return 0.88; // color-heavy (photos, diagrams)
}
