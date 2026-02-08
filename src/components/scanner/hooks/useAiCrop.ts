import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ImportedDoc } from "../ImportPreviewCarousel";

/**
 * Converts an image data URL to a canvas-based cropped data URL
 */
function cropImageFromNormalized(
  imageData: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(crop.x * img.width);
      const sy = Math.round(crop.y * img.height);
      const sw = Math.round(crop.width * img.width);
      const sh = Math.round(crop.height * img.height);

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

/**
 * Compress image to base64 for sending to AI (max ~2MB)
 */
async function compressForAi(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1500;
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
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

interface AiCropResult {
  id: string;
  needs_crop: boolean;
  crop?: { x: number; y: number; width: number; height: number };
  error?: string;
}

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const analyzeAndCrop = useCallback(
    async (
      documents: ImportedDoc[],
      mode: "current" | "all",
      currentIndex: number
    ): Promise<ImportedDoc[]> => {
      // Filter only images that can be cropped
      const targetDocs =
        mode === "current"
          ? [documents[currentIndex]].filter(Boolean)
          : documents;

      const imageDocs = targetDocs.filter(
        (d) => d.preview && d.preview !== "/placeholder.svg" && d.preview.startsWith("data:")
      );

      if (imageDocs.length === 0) {
        toast.info("Aucune image à analyser");
        return documents;
      }

      setIsAnalyzing(true);
      setProgress(0);

      try {
        // Compress images for AI
        const images = await Promise.all(
          imageDocs.map(async (doc) => ({
            id: doc.id,
            base64: await compressForAi(doc.preview),
          }))
        );

        setProgress(30);

        // Call edge function
        const { data, error } = await supabase.functions.invoke("ai-crop-detect", {
          body: { images },
        });

        if (error) throw new Error(error.message);

        setProgress(70);

        const results: AiCropResult[] = data?.results || [];
        let croppedCount = 0;

        // Apply crops
        const updatedDocs = await Promise.all(
          documents.map(async (doc) => {
            const result = results.find((r) => r.id === doc.id);
            if (!result || !result.needs_crop || !result.crop) return doc;

            try {
              const cropped = await cropImageFromNormalized(doc.preview, result.crop);
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

  return { analyzeAndCrop, isAnalyzing, progress };
}
