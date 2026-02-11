import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MergeableDocument {
  id: string;
  nom: string;
  url: string;
}

export function useExportMergedPdf() {
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();

  const mergePdfs = useCallback(async (
    documents: MergeableDocument[],
    outputName: string = "Documents fusionnés"
  ): Promise<Blob | null> => {
    if (documents.length === 0) {
      toast.error("Aucun document à fusionner");
      return null;
    }

    setIsMerging(true);
    setProgress(0);

    try {
      // Dynamically import pdf-lib for merging
      const { PDFDocument } = await import("pdf-lib");
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < documents.length; i++) {
        setProgress(Math.round(((i + 1) / documents.length) * 90));

        try {
          const doc = documents[i];
          let url = doc.url;
          
          // If relative URL, prepend storage base
          if (!url.startsWith("http")) {
            const { data } = supabase.storage.from("documents").getPublicUrl(url);
            url = data.publicUrl;
          }

          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to fetch ${doc.nom}: ${response.status}`);
            continue;
          }

          const contentType = response.headers.get("content-type") || "";
          const arrayBuffer = await response.arrayBuffer();

          if (contentType.includes("pdf")) {
            // Merge PDF pages
            const srcPdf = await PDFDocument.load(arrayBuffer);
            const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          } else if (contentType.includes("image")) {
            // Embed image as a full page
            const bytes = new Uint8Array(arrayBuffer);
            let image;
            if (contentType.includes("png")) {
              image = await mergedPdf.embedPng(bytes);
            } else {
              image = await mergedPdf.embedJpg(bytes);
            }
            const page = mergedPdf.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          }
        } catch (err) {
          console.warn(`Error processing document ${documents[i].nom}:`, err);
        }
      }

      if (mergedPdf.getPageCount() === 0) {
        toast.error("Aucun document n'a pu être fusionné");
        return null;
      }

      setProgress(95);
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      setProgress(100);

      toast.success(`${mergedPdf.getPageCount()} pages fusionnées en un PDF`);
      return blob;
    } catch (err: any) {
      console.error("Merge error:", err);
      toast.error("Erreur lors de la fusion");
      return null;
    } finally {
      setIsMerging(false);
      setProgress(0);
    }
  }, []);

  const downloadMergedPdf = useCallback(async (
    documents: MergeableDocument[],
    outputName: string = "Documents fusionnés"
  ) => {
    const blob = await mergePdfs(documents, outputName);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${outputName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [mergePdfs]);

  const shareMergedPdf = useCallback(async (
    documents: MergeableDocument[],
    outputName: string = "Documents fusionnés"
  ) => {
    const blob = await mergePdfs(documents, outputName);
    if (!blob) return;

    if (navigator.share) {
      try {
        const file = new File([blob], `${outputName}.pdf`, { type: "application/pdf" });
        await navigator.share({ files: [file], title: outputName });
      } catch {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${outputName}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  }, [mergePdfs]);

  return { mergePdfs, downloadMergedPdf, shareMergedPdf, isMerging, progress };
}
