import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { EtudeData } from "@/lib/exportEtudePdf";

import type { RegieRecapDetails } from "@/lib/regieRecap";

interface WhatsAppSendButtonProps {
  clientName: string;
  clientPrenom?: string;
  classification: string;
  comment?: string;
  r2DateTime?: string | null;
  cqTime?: string;
  cqDate?: string; // YYYY-MM-DD; defaults to tomorrow if omitted
  regieId?: string | null;
  pdfData?: EtudeData;
  venteDetails?: RegieRecapDetails;
  etudeId?: string | null;
  rdvId?: string;
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
  cqDate,
  regieId,
  pdfData,
  venteDetails,
  etudeId,
  rdvId,
  compact = false,
  className = "",
}: WhatsAppSendButtonProps) {
  const [sending, setSending] = useState(false);
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSend = async () => {
    if (!user) return;
    // Desktop : pré-ouvrir l'onglet dans le clic (iOS bloque window.open après
    // un traitement async). Mobile : pas de fenêtre vide — la page courante
    // navigue vers whatsapp://, ce qui ouvre l'app sans onglet blanc.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
    const targetWindow = isMobile ? null : window.open("", "_blank");
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
        cqDate,
        pdfData,
        regieId,
        venteDetails,
        etudeId,
        rdvId,
        targetWindow,
      });
      if (!success) targetWindow?.close();
      if (success) {
        if (classification !== "positif") toast({ title: "WhatsApp ouvert", description: "Le récapitulatif texte est prêt à envoyer" });
      } else {
        toast({ variant: "destructive", title: "Envoi indisponible", description: "Vérifiez le contact WhatsApp de la régie et réessayez." });
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
