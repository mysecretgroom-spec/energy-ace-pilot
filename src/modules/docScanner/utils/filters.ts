/**
 * Image filter presets operating on ImageData in-place.
 * All filters work on RGBA Uint8ClampedArray.
 */

import type { FilterPreset } from "../types";

export function applyFilter(data: ImageData, preset: FilterPreset): void {
  switch (preset) {
    case "original": break;
    case "photo": applyPhoto(data); break;
    case "document": applyDocument(data); break;
    case "bw": applyBW(data); break;
    case "enhanced": applyEnhanced(data); break;
  }
}

/** Photo: slight contrast + sharpen */
function applyPhoto(data: ImageData) {
  adjustContrast(data, 1.15);
  unsharpMask(data, 0.3);
}

/** Document: white balance + background lighten + text enhance + unsharp */
function applyDocument(data: ImageData) {
  const { data: d, width, height } = data;

  // Approximate white balance: find brightest quartile average
  const samples: number[] = [];
  for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    samples.push(lum);
  }
  samples.sort((a, b) => b - a);
  const brightAvg = samples.slice(0, Math.floor(samples.length * 0.25))
    .reduce((s, v) => s + v, 0) / Math.floor(samples.length * 0.25) || 255;
  const wbFactor = 240 / Math.max(brightAvg, 1);

  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;

    // Background lighten: push bright pixels toward white
    if (lum > 160) {
      const blend = Math.min((lum - 160) / 60, 1) * 0.6;
      d[i] = Math.min(255, d[i] + (255 - d[i]) * blend);
      d[i + 1] = Math.min(255, d[i + 1] + (255 - d[i + 1]) * blend);
      d[i + 2] = Math.min(255, d[i + 2] + (255 - d[i + 2]) * blend);
    } else {
      // Darken text
      const factor = Math.max(0.7, 1 - (160 - lum) / 400);
      d[i] = Math.round(d[i] * factor);
      d[i + 1] = Math.round(d[i + 1] * factor);
      d[i + 2] = Math.round(d[i + 2] * factor);
    }

    // White balance
    d[i] = Math.min(255, Math.round(d[i] * Math.min(wbFactor, 1.3)));
    d[i + 1] = Math.min(255, Math.round(d[i + 1] * Math.min(wbFactor, 1.3)));
    d[i + 2] = Math.min(255, Math.round(d[i + 2] * Math.min(wbFactor, 1.3)));
  }

  unsharpMask(data, 0.5);
}

/** B&W: adaptive threshold (block mean) */
function applyBW(data: ImageData) {
  const { data: d, width, height } = data;
  const gray = new Uint8Array(width * height);

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(
      d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114
    );
  }

  // Integral image for fast block mean
  const blockSize = Math.max(15, Math.round(Math.min(width, height) / 30) | 1);
  const halfBlock = Math.floor(blockSize / 2);
  const C = 10; // threshold constant

  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        rowSum + integral[y * (width + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const mean = sum / count;
      const val = gray[y * width + x] < mean - C ? 0 : 255;

      const idx = (y * width + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = val;
    }
  }
}

/** Enhanced: gamma + local contrast + unsharp mask */
function applyEnhanced(data: ImageData) {
  const { data: d } = data;
  const gamma = 0.85; // slightly brighten

  // Gamma + contrast
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = d[i + c] / 255;
      v = Math.pow(v, gamma); // gamma
      v = (v - 0.5) * 1.2 + 0.5; // contrast
      d[i + c] = Math.min(255, Math.max(0, Math.round(v * 255)));
    }
  }

  // Shadow reduction: lift dark areas
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum < 80) {
      const lift = (80 - lum) / 80 * 0.3;
      for (let c = 0; c < 3; c++) {
        d[i + c] = Math.min(255, Math.round(d[i + c] + lift * 255 * 0.2));
      }
    }
  }

  unsharpMask(data, 0.6);
}

/** Simple contrast adjustment */
function adjustContrast(data: ImageData, factor: number) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.min(255, Math.max(0, Math.round((d[i + c] - 128) * factor + 128)));
    }
  }
}

/** Simple unsharp mask using 3x3 box blur */
function unsharpMask(data: ImageData, amount: number) {
  const { data: d, width, height } = data;
  const copy = new Uint8ClampedArray(d);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        // 3x3 average
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += copy[((y + dy) * width + (x + dx)) * 4 + c];
          }
        }
        const blur = sum / 9;
        const sharp = d[idx + c] + (d[idx + c] - blur) * amount;
        d[idx + c] = Math.min(255, Math.max(0, Math.round(sharp)));
      }
    }
  }
}
