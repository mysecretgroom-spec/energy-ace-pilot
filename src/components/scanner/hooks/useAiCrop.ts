import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ImportedDoc } from "../ImportPreviewCarousel";

/**
 * Normalized 4-corner points (0-1) returned by AI
 */
export interface AiCropCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

interface AiCropResult {
  id: string;
  needs_crop: boolean;
  corners?: AiCropCorners;
  error?: string;
}

/**
 * Compress image to base64 for sending to AI (max ~2MB)
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

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * Detect crop corners via AI. Returns the doc ID and corners if crop is needed.
   * Does NOT apply the crop — caller should open CropEditor with these corners.
   */
  const detectCropCorners = useCallback(
    async (
      doc: ImportedDoc
    ): Promise<{ docId: string; corners: AiCropCorners } | null> => {
      if (!doc.preview || doc.preview === "/placeholder.svg" || !doc.preview.startsWith("data:")) {
        toast.info("Aucune image à analyser");
        return null;
      }

      setIsAnalyzing(true);
      setProgress(0);

      try {
        const compressed = await compressForAi(doc.preview);
        setProgress(30);

        const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
          body: { images: [{ id: doc.id, base64: compressed }] },
        });

        if (error) throw new Error(error.message);
        setProgress(80);

        const results: AiCropResult[] = data?.results || [];
        const result = results[0];

        if (result?.needs_crop && result.corners) {
          setProgress(100);
          toast.success("Document détecté — ajustez le cadrage");
          return { docId: doc.id, corners: result.corners };
        } else {
          toast.info("Aucun recadrage nécessaire détecté");
          return null;
        }
      } catch (err: any) {
        console.error("AI crop error:", err);
        toast.error("Erreur lors de l'analyse IA");
        return null;
      } finally {
        setIsAnalyzing(false);
        setProgress(0);
      }
    },
    []
  );

  /**
   * Batch detect: returns array of results for multiple docs.
   * For batch mode, auto-crop is applied directly (no manual editor).
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
        const images = await Promise.all(
          imageDocs.map(async (doc) => ({
            id: doc.id,
            base64: await compressForAi(doc.preview),
          }))
        );

        setProgress(30);

        const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
          body: { images },
        });

        if (error) throw new Error(error.message);
        setProgress(70);

        const results: AiCropResult[] = data?.results || [];
        let croppedCount = 0;

        const updatedDocs = await Promise.all(
          documents.map(async (doc) => {
            const result = results.find((r) => r.id === doc.id);
            if (!result || !result.needs_crop || !result.corners) return doc;

            try {
              const cropped = await cropFromCorners(doc.preview, result.corners);
              croppedCount++;
              return {
                ...doc,
                preview: cropped,
                processedPreview: undefined,
                activeFilter: "original",
                rotation: 0,
              };
            } catch (err) {
              console.warn("Crop failed for", doc.id, err);
              return doc;
            }
          })
        );

        setProgress(100);

        if (croppedCount > 0) {
          toast.success(`${croppedCount} document${croppedCount > 1 ? "s" : ""} recadré${croppedCount > 1 ? "s" : ""} par l'IA`);
        } else {
          toast.info("Aucun recadrage nécessaire détecté");
        }

        return updatedDocs;
      } catch (err: any) {
        console.error("AI crop error:", err);
        toast.error("Erreur lors de l'analyse IA");
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
