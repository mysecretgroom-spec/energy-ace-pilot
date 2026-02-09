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

interface AiCropResult {
  id: string;
  needs_crop: boolean;
  corners?: AiCropCorners;
  error?: string;
}

/**
 * Compress image for AI fallback
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
      // Cleanup
      canvas.width = 0;
      canvas.height = 0;
      resolve(result);
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

/** Small delay to let the browser GC between heavy canvas operations */
function breathe(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Try lightweight local detection first (~50ms), fall back to AI if nothing found
 */
async function detectLocalThenAI(
  docId: string,
  preview: string
): Promise<{ corners: AiCropCorners; source: "local" | "ai" } | null> {
  // 1. Local detection (pure JS, instant, no heavy libs)
  try {
    const edges = await detectDocumentEdgesLight(preview);
    if (edges && edges.confidence > 0.25) {
      return {
        corners: {
          topLeft: edges.topLeft,
          topRight: edges.topRight,
          bottomRight: edges.bottomRight,
          bottomLeft: edges.bottomLeft,
        },
        source: "local",
      };
    }
  } catch (err) {
    console.warn("Local detection failed:", err);
  }

  // 2. AI fallback for complex scenes
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
    console.warn("AI fallback also failed:", err);
  }

  // Fallback: return full-image corners so the user always gets a crop frame
  const m = 0.02; // 2% margin
  return {
    corners: {
      topLeft: { x: m, y: m },
      topRight: { x: 1 - m, y: m },
      bottomRight: { x: 1 - m, y: 1 - m },
      bottomLeft: { x: m, y: 1 - m },
    },
    source: "local" as const,
  };
}

/** Batch size for processing to avoid memory pressure */
const BATCH_SIZE = 3;

export function useAiCrop() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelledRef = useRef(false);

  /**
   * Detect crop corners for a single doc.
   * Uses lightweight local detection first (instant), AI fallback if needed.
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
        const result = await detectLocalThenAI(doc.id, doc.preview);
        setProgress(100);

        if (result) {
          toast.success(
            result.source === "local"
              ? "Document détecté — ajustez le cadrage"
              : "Document détecté (IA) — ajustez le cadrage"
          );
          return { docId: doc.id, corners: result.corners };
        }
        // Should not happen since detectLocalThenAI always returns corners now
        return null;
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
   * Batch detect and auto-crop multiple docs.
   * Processes in small batches with memory cleanup to prevent crashes.
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
      cancelledRef.current = false;

      try {
        let croppedCount = 0;
        let errorCount = 0;
        const total = imageDocs.length;
        const resultMap = new Map<string, string>(); // docId → cropped dataUrl

        // Process in small batches to avoid memory saturation
        for (let batchStart = 0; batchStart < imageDocs.length; batchStart += BATCH_SIZE) {
          if (cancelledRef.current) break;

          const batch = imageDocs.slice(batchStart, batchStart + BATCH_SIZE);

          // Step 1: Detect corners for all docs in this batch
          const detections: { doc: ImportedDoc; corners: AiCropCorners }[] = [];
          for (const doc of batch) {
            if (cancelledRef.current) break;
            try {
              const result = await detectLocalThenAI(doc.id, doc.preview);
              if (result) {
                detections.push({ doc, corners: result.corners });
              }
            } catch (err) {
              console.warn("Detection failed for", doc.id, err);
              errorCount++;
            }
          }

          // Step 2: Apply perspective correction one by one with breathing room
          for (const { doc, corners } of detections) {
            if (cancelledRef.current) break;
            try {
              const cropped = await applyPerspectiveCorrectionLight(doc.preview, corners);
              resultMap.set(doc.id, cropped);
              croppedCount++;
            } catch (err) {
              console.warn("Crop failed for", doc.id, err);
              errorCount++;
            }
            // Let the browser breathe between heavy canvas ops
            await breathe(30);
          }

          // Update progress
          const processed = Math.min(batchStart + BATCH_SIZE, total);
          setProgress(Math.round((processed / total) * 100));

          // Longer pause between batches for GC
          if (batchStart + BATCH_SIZE < imageDocs.length) {
            await breathe(100);
          }
        }

        // Build updated documents array
        const updatedDocs = documents.map((doc) => {
          const cropped = resultMap.get(doc.id);
          if (!cropped) return doc;
          return {
            ...doc,
            preview: cropped,
            processedPreview: undefined,
            activeFilter: "original",
            rotation: 0,
          };
        });

        if (croppedCount > 0) {
          const msg = `${croppedCount} document${croppedCount > 1 ? "s" : ""} recadré${croppedCount > 1 ? "s" : ""}`;
          toast.success(errorCount > 0 ? `${msg} (${errorCount} erreur${errorCount > 1 ? "s" : ""})` : msg);
        } else {
          toast.info("Aucun recadrage nécessaire détecté");
        }

        return updatedDocs;
      } catch (err: any) {
        console.error("Batch crop error:", err);
        toast.error("Erreur lors de l'analyse par lot");
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
