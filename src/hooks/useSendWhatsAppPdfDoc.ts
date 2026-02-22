import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendPdfDocOptions {
  clientId: string;
  phoneNumber: string;
  message?: string;
  includeEtude?: boolean;
  documentIds?: string[];
}

interface SendPdfDocResult {
  success: boolean;
  pdfUrl?: string;
  pdfSizeMB?: string;
  documentsIncluded?: string[];
  totalPages?: number;
  error?: string;
}

export function useSendWhatsAppPdfDoc() {
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendPdfDocResult | null>(null);

  const sendPdfDoc = async (options: SendPdfDocOptions): Promise<SendPdfDocResult> => {
    setIsSending(true);
    setLastResult(null);

    try {
      // Step 1: Generate the merged PDF (no Twilio send)
      const { data, error } = await supabase.functions.invoke("send-whatsapp-pdf-doc", {
        body: {
          clientId: options.clientId,
          includeEtude: options.includeEtude ?? true,
          documentIds: options.documentIds,
          generateOnly: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.pdfUrl) {
        throw new Error("Aucun PDF généré");
      }

      const clientName = data.clientName || "";
      const docCount = data.documentsIncluded?.length || 0;

      // Step 2: Download PDF and share as file via native Share API
      const pdfResponse = await fetch(data.pdfUrl);
      if (!pdfResponse.ok) throw new Error("Impossible de télécharger le PDF");
      const pdfBlob = await pdfResponse.blob();
      const safeName = `Dossier_${clientName.replace(/\s+/g, "_")}.pdf`;
      const pdfFile = new File([pdfBlob], safeName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Dossier ${clientName}`,
          text: options.message || `📄 Dossier complet pour ${clientName} (${docCount} docs, ${data.totalPages} pages)`,
        });
      } else {
        // Fallback: télécharger le PDF directement
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = safeName;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }

      toast.success("Dossier partagé", {
        description: `${docCount} documents (${data.pdfSizeMB} MB)`,
      });

      const result: SendPdfDocResult = {
        success: true,
        pdfUrl: data.pdfUrl,
        pdfSizeMB: data.pdfSizeMB,
        documentsIncluded: data.documentsIncluded,
        totalPages: data.totalPages,
      };

      setLastResult(result);
      return result;
    } catch (error) {
      console.error("Error generating PDF doc:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error("Erreur lors de la génération", {
        description: errorMessage,
      });

      const result: SendPdfDocResult = {
        success: false,
        error: errorMessage,
      };
      setLastResult(result);
      return result;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendPdfDoc,
    isSending,
    lastResult,
  };
}
