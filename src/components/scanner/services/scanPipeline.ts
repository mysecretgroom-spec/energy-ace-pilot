import { detectDocumentEdgesLight } from "./edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "./perspectiveCorrection";
import { enhanceForDocument, autoDeskew } from "./imageEnhancement";
import { correctDocumentShadows, validScanCorners, type ScanCorners } from "./scanQuality";

export interface AutoCropResult {
  /** Corners used for the pre-crop, null when the page was not found. */
  corners: ScanCorners | null;
  /** Processed page (same default corrections as the crop editor). */
  image: string;
  thumbnail: string;
}

export function makeThumbnail(dataUrl: string, width = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((img.height / img.width) * width);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No ctx"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

/** Detects the page and applies the editor's default corrections (shadows, enhance, deskew). */
export async function autoCropPage(original: string): Promise<AutoCropResult> {
  let corners: ScanCorners | null = null;
  try {
    const edges = await detectDocumentEdgesLight(original);
    if (edges && edges.confidence > 0.5 && validScanCorners(edges)) {
      corners = { topLeft: edges.topLeft, topRight: edges.topRight, bottomRight: edges.bottomRight, bottomLeft: edges.bottomLeft };
    }
  } catch { /* page not found: keep the original */ }
  if (!corners) return { corners: null, image: original, thumbnail: await makeThumbnail(original) };
  let image = await applyPerspectiveCorrectionLight(original, corners);
  image = await correctDocumentShadows(image);
  image = await enhanceForDocument(image);
  image = await autoDeskew(image);
  return { corners, image, thumbnail: await makeThumbnail(image) };
}
