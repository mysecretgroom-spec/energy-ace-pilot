import React, { useState } from "react";
import { Scan, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadImageToCanvas, downscale, canvasToBlob, releaseCanvas } from "../utils/image";
import type { ScanPage } from "../types";
import { toast } from "sonner";

interface OCRPanelProps {
  page: ScanPage | null;
  onFieldsExtracted: (pageId: string, text: string, fields: Record<string, string>) => void;
}

export function OCRPanel({ page, onFieldsExtracted }: OCRPanelProps) {
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState(page?.ocrText || "");
  const [fields, setFields] = useState<Record<string, string>>(page?.ocrFields || {});

  const handleOCR = async () => {
    if (!page) return;
    setLoading(true);

    try {
      const src = page.warpedPreviewUrl || page.normalizedBlobUrl || page.originalBlobUrl;
      const canvas = await loadImageToCanvas(src);
      const small = downscale(canvas, 1600);
      const blob = await canvasToBlob(small, "image/jpeg", 0.85);

      const reader = new FileReader();
      const base64 = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: { image: base64, mode: "ocr" },
      });

      if (error) throw error;

      const text = data?.text || data?.extracted_text || "";
      const extractedFields = data?.fields || data?.ai_extracted_fields || {};

      setOcrText(text);
      setFields(extractedFields);
      onFieldsExtracted(page.id, text, extractedFields);

      releaseCanvas(canvas);
      releaseCanvas(small);

      toast.success("OCR terminé");
    } catch (err) {
      console.error("OCR error:", err);
      toast.error("Erreur OCR");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ocrText);
    toast.success("Texte copié");
  };

  if (!page) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Sélectionnez une page pour lancer l'OCR
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">OCR / Analyse</h3>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          ☁️ Envoyé au serveur
        </div>
      </div>

      <Button onClick={handleOCR} disabled={loading} variant="outline" className="w-full">
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Scan className="w-4 h-4 mr-2" />
        )}
        {loading ? "Analyse en cours..." : "Lancer l'OCR"}
      </Button>

      {ocrText && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-medium">Texte extrait</label>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2">
              <Copy className="w-3 h-3 mr-1" />
              Copier
            </Button>
          </div>
          <div className="bg-muted rounded-lg p-3 text-xs text-foreground max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
            {ocrText}
          </div>
        </div>
      )}

      {Object.keys(fields).length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Champs extraits</label>
          <div className="space-y-1">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-medium min-w-[80px]">{key}</span>
                <span className="text-xs text-foreground select-text">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
