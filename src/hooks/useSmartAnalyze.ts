import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Compress image before sending to AI to reduce payload size and speed up transfer
async function compressForAnalysis(dataUrl: string): Promise<string> {
  const MAX_DIM = 800;
  const QUALITY = 0.6;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const r = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const result = c.toDataURL("image/jpeg", QUALITY);
      c.width = 0; c.height = 0; // free GPU memory
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

export interface SmartAnalysisResult {
  success: boolean;
  document_type?: string;
  classification_confidence?: number;
  description?: string;
  extracted_text?: string;
  ocr_quality?: number;
  fields?: {
    nom?: string;
    prenom?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    telephone?: string;
    email?: string;
    montant?: number;
    date_document?: string;
    numero_contrat?: string;
    fournisseur?: string;
    iban?: string;
    revenus?: number;
  };
  suggested_name?: string;
  error_message?: string;
}

interface UseSmartAnalyzeOptions {
  autoAnalyze?: boolean;
  onResult?: (result: SmartAnalysisResult) => void;
}

export function useSmartAnalyze(options: UseSmartAnalyzeOptions = {}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SmartAnalysisResult | null>(null);

  const analyze = useCallback(async (
    imageBase64: string,
    documentId?: string,
    userId?: string
  ): Promise<SmartAnalysisResult | null> => {
    setIsAnalyzing(true);
    try {
      // Compress image before sending to reduce payload and speed up transfer
      const compressed = await compressForAnalysis(imageBase64);

      // Race against timeout to prevent hanging
      const invokePromise = supabase.functions.invoke("smart-analyze", {
        body: { 
          image_base64: compressed,
          document_id: documentId,
          user_id: userId,
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Analyse trop longue (timeout)")), 30000)
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      if (error) throw new Error(error.message);

      const analysisResult = data as SmartAnalysisResult;
      setResult(analysisResult);
      options.onResult?.(analysisResult);

      if (analysisResult.success) {
        const parts: string[] = [];
        if (analysisResult.document_type) parts.push(analysisResult.description || analysisResult.document_type);
        if (analysisResult.fields?.nom) parts.push(analysisResult.fields.nom);
        toast.success(`Analyse IA : ${parts.join(" — ") || "terminée"}`);
      }

      return analysisResult;
    } catch (err: any) {
      console.error("Smart analysis error:", err);
      const msg = err.message?.includes("timeout") ? "Analyse trop longue, réessayez" : "Erreur d'analyse IA";
      toast.error(msg);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [options.onResult]);

  return { analyze, isAnalyzing, result };
}
