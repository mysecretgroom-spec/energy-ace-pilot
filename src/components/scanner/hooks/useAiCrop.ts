import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectDocumentEdges, preloadOpenCV } from "../services/edgeDetection";
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

// Preload OpenCV as early as possible
preloadOpenCV();

/**
 * Convert OpenCV pixel corners to normalized 0-1 corners
 */
function normalizeCorners(
  corners: { topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomRight: { x: number; y: number }; bottomLeft: { x: number; y: number } },
  width: number,
  height: number
): AiCropCorners {
  return {
    topLeft: { x: corners.topLeft.x / width, y: corners.topLeft.y / height },
    topRight: { x: corners.topRight.x / width, y: corners.topRight.y / height },
    bottomRight: { x: corners.bottomRight.x / width, y: corners.bottomRight.y / height },
    bottomLeft: { x: corners.bottomLeft.x / width, y: corners.bottomLeft.y / height },
  };
}

/**
 * Get image dimensions from data URL
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

/**
 * Compress image to base64 for AI fallback (max ~2MB)
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
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

/**
 * Try local OpenCV detection first, fall back to AI if it fails
 */
async function detectWithOpenCVThenAI(
  docId: string,
  preview: string
): Promise<{ corners: AiCropCorners; source: "opencv" | "ai" } | null> {
  // 1. Try OpenCV (instant, ~50ms)
  try {
    const edges = await detectDocumentEdges(preview);
    if (edges && edges.confidence > 0.2) {
      const dims = await getImageDimensions(preview);
      const normalized = normalizeCorners(edges, dims.width, dims.height);
      return { corners: normalized, source: "opencv" };
    }
  } catch (err) {
    console.warn("OpenCV detection failed, trying AI fallback:", err);
  }

  // 2. AI fallback (slower but handles complex scenes)
  try {
    const compressed = await compressForAi(preview);
    const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
      body: { images: [{ id: docId, base64: compressed }] },
    });
    if (error) throw new Error(error.message);
    const result = data?.results?.[0];
    if (result?.needs_crop && result.corners) {
      return { corners: result.corners, source: "ai" };
    }
  } catch (err) {
    console.warn("AI crop fallback also failed:", err);
  }

  return null;
}

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Detect crop corners for a single doc. Uses OpenCV first (instant), AI fallback if needed.
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
        const result = await detectWithOpenCVThenAI(doc.id, doc.preview);
        setProgress(100);

        if (result) {
          const sourceLabel = result.source === "opencv" ? "OpenCV" : "IA";
          toast.success(`Document détecté (${sourceLabel}) — ajustez le cadrage`);
          return { docId: doc.id, corners: result.corners };
        } else {
          toast.info("Aucun recadrage nécessaire détecté");
          return null;
        }
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

  /**
   * Batch detect and auto-crop multiple docs using OpenCV (instant per image).
   */
  const analyzeAndCropBatch = useCallback(
    async (documents: ImportedDoc[]): Promise<ImportedDoc[]> => {
      const imageDocs = documents.filter(
        (d) => d.preview && d.preview !== "/placeholder.svg" && d.preview.startsWith("data:")
      );

      if (imageDocs.length === 0) {
        toast.info("Aucune image à analyser");
        return documents;
      }

      setIsAnalyzing(true);
      setProgress(0);

      try {
        let croppedCount = 0;
        const total = imageDocs.length;

        const updatedDocs = await Promise.all(
          documents.map(async (doc, idx) => {
            if (!doc.preview || doc.preview === "/placeholder.svg" || !doc.preview.startsWith("data:")) {
              return doc;
            }

            try {
              const result = await detectWithOpenCVThenAI(doc.id, doc.preview);
              setProgress(Math.round(((idx + 1) / total) * 100));

              if (result) {
                const cropped = await cropFromCorners(doc.preview, result.corners);
                croppedCount++;
                return {
                  ...doc,
                  preview: cropped,
                  processedPreview: undefined,
                  activeFilter: "original",
                  rotation: 0,
                };
              }
            } catch (err) {
              console.warn("Crop failed for", doc.id, err);
            }
            return doc;
          })
        );

        setProgress(100);

        if (croppedCount > 0) {
          toast.success(`${croppedCount} document${croppedCount > 1 ? "s" : ""} recadré${croppedCount > 1 ? "s" : ""}`);
        } else {
          toast.info("Aucun recadrage nécessaire détecté");
        }

        return updatedDocs;
      } catch (err: any) {
        console.error("Batch crop error:", err);
        toast.error("Erreur lors de l'analyse");
        return documents;
      } finally {
        setIsAnalyzing(false);
        setProgress(0);
      }
    },
    []
  );

  return { detectCropCorners, analyzeAndCropBatch, isAnalyzing, progress };
}

/**
 * Crop image using 4 normalized corner points (bounding box approach).
 */
function cropFromCorners(
  imageData: string,
  corners: AiCropCorners
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const minX = Math.min(corners.topLeft.x, corners.bottomLeft.x);
      const maxX = Math.max(corners.topRight.x, corners.bottomRight.x);
      const minY = Math.min(corners.topLeft.y, corners.topRight.y);
      const maxY = Math.max(corners.bottomLeft.y, corners.bottomRight.y);

      const sx = Math.round(minX * img.width);
      const sy = Math.round(minY * img.height);
      const sw = Math.round((maxX - minX) * img.width);
      const sh = Math.round((maxY - minY) * img.height);

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageData;
  });
}
