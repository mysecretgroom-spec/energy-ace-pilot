import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectDocumentEdgesLight } from "../services/edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "../services/perspectiveCorrection";
import type { ImportedDoc } from "../ImportPreviewCarousel";

/**
 * Normalized 4-corner points (0-1) returned by detection
 */
export interface AiCropCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

/**
 * Compress image for AI detection
 */
async function compressForAi(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      const result = canvas.toDataURL("image/jpeg", 0.5);
      canvas.width = 0;
      canvas.height = 0;
      resolve(result);
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

/** Full-image fallback corners */
const FULL_IMAGE_CORNERS: AiCropCorners = {
  topLeft: { x: 0.02, y: 0.02 },
  topRight: { x: 0.98, y: 0.02 },
  bottomRight: { x: 0.98, y: 0.98 },
  bottomLeft: { x: 0.02, y: 0.98 },
};

/**
 * Compute a rectangularity score (0-1) for a quad.
 * 1.0 = perfect rectangle.
 */
function rectangularityScore(c: AiCropCorners): number {
  const pts = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const cc = pts[(i + 2) % 4];
    const v1x = a.x - b.x, v1y = a.y - b.y;
    const v2x = cc.x - b.x, v2y = cc.y - b.y;
    const dot = v1x * v2x + v1y * v2y;
    const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (m1 < 0.001 || m2 < 0.001) return 0;
    angles.push(Math.abs(Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) - Math.PI / 2));
  }
  const avgDev = angles.reduce((s, a) => s + a, 0) / 4;
  return Math.max(0, 1 - avgDev / (Math.PI / 4));
}

/**
 * Compute area of a normalized quad (0-1 coords).
 */
function quadArea(c: AiCropCorners): number {
  const pts = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Compute a composite confidence score combining:
 * - Raw confidence from detector
 * - Rectangularity (documents are rectangles)
 * - Area coverage (documents should cover significant area)
 */
function compositeScore(corners: AiCropCorners, rawConfidence: number): number {
  const rect = rectangularityScore(corners);
  const area = quadArea(corners);
  // Area bonus: prefer quads covering 30-90% of image
  const areaPenalty = area < 0.15 ? 0.5 : area > 0.95 ? 0.8 : 1.0;
  return rawConfidence * 0.5 + rect * 0.3 + areaPenalty * 0.2;
}

interface DetectionResult {
  corners: AiCropCorners;
  confidence: number;
  source: "local" | "ai" | "fallback";
}

/**
 * Run local JS detection and AI detection in parallel.
 * AI receives the local result as a hint to validate/refine.
 * The result with the highest composite confidence wins.
 */
async function detectParallel(
  docId: string,
  preview: string
): Promise<DetectionResult> {
  // 1. Start local detection immediately
  let localCorners: AiCropCorners | null = null;
  let localConfidence = 0;

  try {
    const edges = await detectDocumentEdgesLight(preview);
    if (edges && edges.confidence > 0.15) {
      localCorners = {
        topLeft: edges.topLeft,
        topRight: edges.topRight,
        bottomRight: edges.bottomRight,
        bottomLeft: edges.bottomLeft,
      };
      localConfidence = edges.confidence;
    }
  } catch (err) {
    console.warn("Local detection failed:", err);
  }

  // 2. Call AI with local hint (if available) for validation/refinement
  let aiCorners: AiCropCorners | null = null;
  let aiConfidence = 0;

  try {
    const compressed = await compressForAi(preview);
    const localHint = localCorners
      ? { [docId]: localCorners }
      : undefined;

    const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
      body: {
        images: [{ id: docId, base64: compressed }],
        local_corners: localHint,
      },
    });
    if (error) throw new Error(error.message);
    const result = data?.results?.[0];
    if (result?.needs_crop && result.corners) {
      aiCorners = result.corners as AiCropCorners;
      aiConfidence = typeof result.confidence === "number" ? result.confidence : 0.7;
    }
  } catch (err) {
    console.warn("AI detection failed:", err);
  }

  // 3. Compare composite scores and pick the best
  const candidates: DetectionResult[] = [];

  if (localCorners) {
    candidates.push({
      corners: localCorners,
      confidence: compositeScore(localCorners, localConfidence),
      source: "local",
    });
  }

  if (aiCorners) {
    candidates.push({
      corners: aiCorners,
      confidence: compositeScore(aiCorners, aiConfidence),
      source: "ai",
    });
  }

  if (candidates.length === 0) {
    return { corners: FULL_IMAGE_CORNERS, confidence: 0, source: "fallback" };
  }

  // Sort by composite confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  console.log(
    `[crop] Winner: ${candidates[0].source} (score=${candidates[0].confidence.toFixed(3)})`,
    candidates.length > 1
      ? `| Runner-up: ${candidates[1].source} (score=${candidates[1].confidence.toFixed(3)})`
      : ""
  );

  return candidates[0];
}

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Detect + auto-apply crop on a single document.
   */
  const autoCropSingle = useCallback(
    async (doc: ImportedDoc): Promise<ImportedDoc | null> => {
      if (!doc.preview || doc.preview === "/placeholder.svg" || !doc.preview.startsWith("data:")) {
        toast.info("Aucune image à analyser");
        return null;
      }

      setIsAnalyzing(true);
      setProgress(20);

      try {
        const result = await detectParallel(doc.id, doc.preview);
        setProgress(60);

        const cropped = await applyPerspectiveCorrectionLight(doc.preview, result.corners);
        setProgress(100);

        const label =
          result.source === "ai"
            ? `Recadré (IA, confiance ${Math.round(result.confidence * 100)}%)`
            : result.source === "local"
            ? `Recadré (auto, confiance ${Math.round(result.confidence * 100)}%)`
            : "Cadrage par défaut appliqué";
        toast.success(label);

        return {
          ...doc,
          preview: cropped,
          processedPreview: undefined,
          activeFilter: "original",
          rotation: 0,
        };
      } catch (err: any) {
        console.error("Auto-crop error:", err);
        toast.error("Erreur lors du recadrage");
        return null;
      } finally {
        setIsAnalyzing(false);
        setProgress(0);
      }
    },
    []
  );

  /**
   * Detect crop corners only (for opening CropEditor with pre-positioned handles).
   */
  const detectCropCorners = useCallback(
    async (doc: ImportedDoc): Promise<{ docId: string; corners: AiCropCorners } | null> => {
      if (!doc.preview || doc.preview === "/placeholder.svg" || !doc.preview.startsWith("data:")) {
        toast.info("Aucune image à analyser");
        return null;
      }

      setIsAnalyzing(true);
      setProgress(10);

      try {
        const result = await detectParallel(doc.id, doc.preview);
        setProgress(100);

        const label =
          result.source === "ai"
            ? `Détecté (IA, ${Math.round(result.confidence * 100)}%) — ajustez`
            : result.source === "local"
            ? `Détecté (auto, ${Math.round(result.confidence * 100)}%) — ajustez`
            : "Cadrage par défaut — ajustez manuellement";
        toast.success(label);

        return { docId: doc.id, corners: result.corners };
      } catch (err: any) {
        console.error("Crop detection error:", err);
        toast.error("Erreur lors de la détection");
        return null;
      } finally {
        setIsAnalyzing(false);
        setProgress(0);
      }
    },
    []
  );

  return { detectCropCorners, autoCropSingle, isAnalyzing, progress };
}
