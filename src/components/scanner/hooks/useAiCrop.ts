import { useState, useCallback, useRef } from "react";
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
 * Run local JS detection and AI detection in parallel.
 * Return the best result (highest confidence), or full-image fallback.
 */
async function detectParallel(
  docId: string,
  preview: string
): Promise<{ corners: AiCropCorners; source: "local" | "ai" | "fallback" }> {
  // Launch both detections simultaneously
  const localPromise = detectDocumentEdgesLight(preview).catch(() => null);
  const aiPromise = (async () => {
    try {
      const compressed = await compressForAi(preview);
      const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
        body: { images: [{ id: docId, base64: compressed }] },
      });
      if (error) throw new Error(error.message);
      const result = data?.results?.[0];
      if (result?.needs_crop && result.corners) {
        return result.corners as AiCropCorners;
      }
      return null;
    } catch (err) {
      console.warn("AI detection failed:", err);
      return null;
    }
  })();

  const [localResult, aiResult] = await Promise.all([localPromise, aiPromise]);

  // Pick best: prefer AI if available (more precise), else local if confident
  if (aiResult) {
    return { corners: aiResult, source: "ai" };
  }
  if (localResult && localResult.confidence > 0.20) {
    return {
      corners: {
        topLeft: localResult.topLeft,
        topRight: localResult.topRight,
        bottomRight: localResult.bottomRight,
        bottomLeft: localResult.bottomLeft,
      },
      source: "local",
    };
  }

  // Fallback: full image
  return { corners: FULL_IMAGE_CORNERS, source: "fallback" };
}

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Detect + auto-apply crop on a single document.
   * Returns the updated doc with cropped preview, or null if unchanged.
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
        const { corners, source } = await detectParallel(doc.id, doc.preview);
        setProgress(60);

        // Apply perspective correction directly
        const cropped = await applyPerspectiveCorrectionLight(doc.preview, corners);
        setProgress(100);

        const label =
          source === "ai" ? "Recadré (IA)" :
          source === "local" ? "Recadré" : "Cadrage par défaut appliqué";
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
        const { corners, source } = await detectParallel(doc.id, doc.preview);
        setProgress(100);

        const label =
          source === "ai" ? "Document détecté (IA) — ajustez le cadrage" :
          source === "local" ? "Document détecté — ajustez le cadrage" :
          "Cadrage par défaut — ajustez manuellement";
        toast.success(label);

        return { docId: doc.id, corners };
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
