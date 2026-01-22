import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SendWhatsAppParams {
  clientName: string;
  clientPrenom?: string;
  classification: string;
  comment?: string;
  r2DateTime?: string | null;
  userId: string;
}

// Classification labels for display
const classificationLabels: Record<string, string> = {
  positif: "✅ POSITIF",
  negatif: "❌ NÉGATIF",
  r2: "🔄 R2 - Second RDV",
  r2_prestudy: "📋 R2 Pré-étude",
  attente: "⏳ En attente",
  annule: "🚫 Annulé",
};

export const useWhatsAppNotification = () => {
  const sendWhatsAppNotification = async ({
    clientName,
    clientPrenom,
    classification,
    comment,
    r2DateTime,
    userId,
  }: SendWhatsAppParams): Promise<boolean> => {
    try {
      // Fetch notification settings
      const { data: settings } = await supabase
        .from("settings_notifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!settings || !settings.whatsapp_enabled || !settings.confirmateur_phone) {
        console.log("[WhatsApp] Notifications désactivées ou numéro non configuré");
        return false;
      }

      // Clean phone number for wa.me link (remove + and spaces)
      const cleanPhone = settings.confirmateur_phone.replace(/[+\s-]/g, "");

      // Build the message
      const fullName = [clientPrenom, clientName].filter(Boolean).join(" ");
      const statusLabel = classificationLabels[classification] || classification;
      const now = new Date();
      const dateStr = format(now, "dd/MM/yyyy 'à' HH:mm", { locale: fr });

      let message = `📋 *MISE À JOUR DOSSIER*\n\n`;
      message += `👤 Client: *${fullName}*\n`;
      message += `📅 Date: ${dateStr}\n`;
      message += `📊 Statut: ${statusLabel}\n`;

      // Add R2 date if applicable
      if (r2DateTime && (classification === "r2" || classification === "r2_prestudy")) {
        const r2Date = new Date(r2DateTime);
        const r2DateStr = format(r2Date, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
        message += `\n📆 *RDV R2 prévu:*\n${r2DateStr}\n`;
      }

      // Add comment if present
      if (comment) {
        message += `\n💬 Commentaire:\n${comment}\n`;
      }

      message += `\n---\n_Envoyé depuis SolarFlow_`;

      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, "_blank");

      return true;
    } catch (error) {
      console.error("[WhatsApp] Erreur:", error);
      return false;
    }
  };

  return { sendWhatsAppNotification };
};
