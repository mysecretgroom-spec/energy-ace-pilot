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

// Default templates with placeholders
const DEFAULT_TEMPLATES: Record<string, string> = {
  positif: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ✅ POSITIF

🎉 Excellent ! Le client est intéressé et prêt à avancer.

{{comment}}

---
_Envoyé depuis SolarFlow_`,

  negatif: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ❌ NÉGATIF

Le client n'est pas intéressé pour le moment.

{{comment}}

---
_Envoyé depuis SolarFlow_`,

  r2: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 🔄 R2 - Second RDV

📆 *RDV R2 prévu:*
{{r2_date}}

{{comment}}

---
_Envoyé depuis SolarFlow_`,

  r2_prestudy: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 📋 R2 Pré-étude

📆 *RDV R2 prévu:*
{{r2_date}}

Une pré-étude sera effectuée avant le second rendez-vous.

{{comment}}

---
_Envoyé depuis SolarFlow_`,

  attente: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: ⏳ En attente

Le dossier est en attente de décision du client.

{{comment}}

---
_Envoyé depuis SolarFlow_`,

  annule: `📋 *MISE À JOUR DOSSIER*

👤 Client: *{{client_name}}*
📅 Date: {{date}}
📊 Statut: 🚫 Annulé

Le rendez-vous a été annulé.

{{comment}}

---
_Envoyé depuis SolarFlow_`,
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

      // Fetch custom template for this classification
      const { data: customTemplate } = await supabase
        .from("whatsapp_templates")
        .select("template_text")
        .eq("user_id", userId)
        .eq("classification", classification)
        .eq("is_active", true)
        .maybeSingle();

      // Clean phone number for wa.me link (remove + and spaces)
      const cleanPhone = settings.confirmateur_phone.replace(/[+\s-]/g, "");

      // Build the message using template
      const fullName = [clientPrenom, clientName].filter(Boolean).join(" ");
      const now = new Date();
      const dateStr = format(now, "dd/MM/yyyy 'à' HH:mm", { locale: fr });

      // Get R2 date formatted
      let r2DateStr = "";
      if (r2DateTime && (classification === "r2" || classification === "r2_prestudy")) {
        const r2Date = new Date(r2DateTime);
        r2DateStr = format(r2Date, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
      }

      // Format comment
      const commentText = comment ? `💬 Commentaire:\n${comment}` : "";

      // Get template (custom or default)
      const templateText = customTemplate?.template_text || DEFAULT_TEMPLATES[classification] || DEFAULT_TEMPLATES.attente;

      // Replace placeholders
      const message = templateText
        .replace(/\{\{client_name\}\}/g, fullName)
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{r2_date\}\}/g, r2DateStr || "Non défini")
        .replace(/\{\{comment\}\}/g, commentText);

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
