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

      // Find optimal threshold using Otsu's method
      const total = canvas.width * canvas.height;
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
      }

      let sumB = 0;
      let wB = 0;
      let maxVariance = 0;
      let optimalThreshold = threshold;

      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;

        const wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) {
          maxVariance = variance;
          optimalThreshold = t;
        }
      }

      // Apply threshold
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const value = gray > optimalThreshold ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}
