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
  messageSid?: string;
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
      // Format phone number
      let phoneNumber = options.phoneNumber.replace(/\D/g, "");
      if (phoneNumber.startsWith("0")) {
        phoneNumber = `33${phoneNumber.slice(1)}`;
      }
      if (!phoneNumber.startsWith("+")) {
        phoneNumber = `+${phoneNumber}`;
      }

      const { data, error } = await supabase.functions.invoke("send-whatsapp-pdf-doc", {
        body: {
          clientId: options.clientId,
          phoneNumber,
          message: options.message,
          includeEtude: options.includeEtude ?? true,
          documentIds: options.documentIds,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        // Even if WhatsApp failed, we might have the PDF URL
        if (data.pdfUrl) {
          toast.warning("Le PDF a été créé mais l'envoi WhatsApp a échoué", {
            description: "Vous pouvez télécharger le PDF et l'envoyer manuellement",
            action: {
              label: "Télécharger",
              onClick: () => window.open(data.pdfUrl, "_blank"),
            },
          });
        } else {
          throw new Error(data.error);
        }
      } else {
        toast.success("Dossier envoyé par WhatsApp", {
          description: `${data.documentsIncluded?.length || 0} documents (${data.pdfSizeMB} MB)`,
        });
      }

      const result: SendPdfDocResult = {
        success: !data?.error,
        messageSid: data?.messageSid,
        pdfUrl: data?.pdfUrl,
        pdfSizeMB: data?.pdfSizeMB,
        documentsIncluded: data?.documentsIncluded,
        totalPages: data?.totalPages,
        error: data?.error,
      };

      setLastResult(result);
      return result;
    } catch (error) {
      console.error("Error sending PDF doc:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error("Erreur lors de l'envoi", {
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
