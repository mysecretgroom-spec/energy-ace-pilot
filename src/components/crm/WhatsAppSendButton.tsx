import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { EtudeData } from "@/lib/exportEtudePdf";

interface WhatsAppSendButtonProps {
  clientName: string;
  clientPrenom?: string;
  classification: string;
  comment?: string;
  r2DateTime?: string | null;
  cqTime?: string;
  regieId?: string | null;
  pdfData?: EtudeData;
  venteDetails?: {
    telephone?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    puissanceKwc?: number;
    prixTTC?: number;
    totalAides?: number;
    primeAutoconsommation?: number;
    ecoTva?: number;
    productType?: string;
  };
  compact?: boolean;
  className?: string;
}

export function WhatsAppSendButton({
  clientName,
  clientPrenom,
  classification,
  comment,
  r2DateTime,
  cqTime,
  regieId,
  pdfData,
  venteDetails,
  compact = false,
  className = "",
}: WhatsAppSendButtonProps) {
  const [sending, setSending] = useState(false);
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    try {
      const success = await sendWhatsAppNotification({
        clientName,
        clientPrenom,
        classification,
        comment,
        r2DateTime,
        userId: user.id,
        cqTime,
        pdfData,
        regieId,
        venteDetails,
      });
      if (success) {
        toast({ title: "WhatsApp envoyé", description: "Le récapitulatif a été partagé" });
      }
    } catch (err) {
      console.error("[WhatsApp] Erreur:", err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer le message WhatsApp" });
    } finally {
      setSending(false);
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 text-[#25D366] hover:bg-[#25D366]/10 ${className}`}
        onClick={(e) => { e.stopPropagation(); handleSend(); }}
        disabled={sending}
        title="Envoyer le récap WhatsApp"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button
      className={`gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white ${className}`}
      onClick={handleSend}
      disabled={sending}
    >
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      Envoyer récap WhatsApp
    </Button>
  );
}
