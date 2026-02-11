import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EnhancementType = "auto" | "shadow_removal" | "unwrinkle" | "clean_background";

interface CompressOptions {
  maxDim?: number;
  quality?: number;
}

async function compressForAI(dataUrl: string, opts: CompressOptions = {}): Promise<string> {
  const { maxDim = 800, quality = 0.6 } = opts;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
      c.width = 0; c.height = 0; // free GPU memory
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

export function useDocumentEnhancement() {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementType, setEnhancementType] = useState<EnhancementType>("auto");

  const enhance = useCallback(async (
    imageBase64: string,
    type: EnhancementType = "auto"
  ): Promise<string | null> => {
    setIsEnhancing(true);
    setEnhancementType(type);

    try {
      const compressed = await compressForAI(imageBase64);

      const { data, error } = await supabase.functions.invoke("enhance-document-image", {
        body: {
          image_base64: compressed,
          enhancement_type: type,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success && data?.enhanced_image) {
        const labels: Record<EnhancementType, string> = {
          auto: "Document amélioré",
          shadow_removal: "Ombres supprimées",
          unwrinkle: "Document défroissé",
          clean_background: "Fond nettoyé",
        };
        toast.success(labels[type] || "Amélioration appliquée ✨");
        return data.enhanced_image;
      } else {
        toast.error("Amélioration impossible");
        return null;
      }
    } catch (err: any) {
      console.error("Enhancement error:", err);
      toast.error("Erreur lors de l'amélioration");
      return null;
    } finally {
      setIsEnhancing(false);
    }
  }, []);

  return { enhance, isEnhancing, enhancementType };
}
