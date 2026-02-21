/** Shared types for the docScanner module */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export type FilterPreset = "original" | "photo" | "document" | "bw" | "enhanced";

export type ExportFormat = "pdf" | "jpeg" | "png";
export type PdfMode = "a4" | "original";
export type CompressionQuality = "high" | "medium" | "low";

export interface ExportSettings {
  format: ExportFormat;
  quality: CompressionQuality;
  pdfMode: PdfMode;
  margins: 0 | 5;
}

export interface ScanPage {
  id: string;
  originalBlobUrl: string;
  originalSize: Size;
  normalizedBlobUrl: string;
  quad: Quad;
  filterPreset: FilterPreset;
  rotation: 0 | 90 | 180 | 270;
  warpedPreviewUrl: string | null;
  ocrText?: string;
  ocrFields?: Record<string, string>;
  aiCornersUsed?: boolean;
}

export interface ScanSession {
  pages: ScanPage[];
  activePageId: string | null;
  exportSettings: ExportSettings;
}

/** Worker message types */
export type WorkerCommand =
  | { type: "detect"; imageData: Uint8ClampedArray; width: number; height: number }
  | { type: "warp"; imageData: Uint8ClampedArray; width: number; height: number; quad: Quad; maxDim?: number }
  | { type: "filter"; imageData: Uint8ClampedArray; width: number; height: number; preset: FilterPreset };

export type WorkerResult =
  | { type: "detect"; quad: Quad | null; confidence: number }
  | { type: "warp"; imageData: Uint8ClampedArray; width: number; height: number }
  | { type: "filter"; imageData: Uint8ClampedArray; width: number; height: number };

export const QUALITY_MAP: Record<CompressionQuality, number> = {
  high: 0.92,
  medium: 0.75,
  low: 0.55,
};

export const MAX_OUTPUT_DIM = 2048;
export const MAX_PREVIEW_DIM = 1200;
export const MAX_ANALYSIS_DIM = 1280;
export const MAX_EXPORT_DIM = 2400;
