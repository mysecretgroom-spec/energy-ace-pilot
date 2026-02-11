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

      // Step 2: Format phone number for wa.me
      let phone = options.phoneNumber.replace(/[\s\-+]/g, "");
      if (phone.startsWith("0")) {
        phone = `33${phone.slice(1)}`;
      }

      // Step 3: Build WhatsApp message with PDF link
      const clientName = data.clientName || "";
      const docCount = data.documentsIncluded?.length || 0;
      const msgText = options.message 
        || `📄 Dossier complet pour ${clientName} (${docCount} docs, ${data.totalPages} pages)\n\n${data.pdfUrl}`;

      const encodedMsg = encodeURIComponent(msgText);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodedMsg}`;

      // Step 4: Open WhatsApp
      window.open(whatsappUrl, "_blank");

      toast.success("Dossier prêt à envoyer", {
        description: `${docCount} documents (${data.pdfSizeMB} MB) — WhatsApp ouvert`,
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
