import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EtudeData, getEtudePdfBlob } from "@/lib/exportEtudePdf";

interface SendWhatsAppParams {
  clientName: string;
  clientPrenom?: string;
  classification: string;
  comment?: string;
  r2DateTime?: string | null;
  userId: string;
  cqTime?: string;
  pdfData?: EtudeData;
  regieId?: string | null; // NEW: régie associée au RDV
}

// Decode HTML entities to proper Unicode characters
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
};

// Default templates with placeholders
const DEFAULT_TEMPLATES: Record<string, string> = {
  positif: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: POSITIF

Le client est intéressé et prêt à avancer.

*CQ prévu:*
{{cq_date}}

{{comment}}

---
_Envoyé depuis DébalePro_`,

  negatif: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: NÉGATIF

Le client n'est pas intéressé pour le moment.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  r2: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: R2 - Second RDV

*RDV R2 prévu:*
{{r2_date}}

{{comment}}

---
_Envoyé depuis DébalePro_`,

  r2_prestudy: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: R2 Pré-étude

*RDV R2 prévu:*
{{r2_date}}

*Document PDF joint:*
L'étude technique a été partagée séparément.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  attente: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: En attente

Le dossier est en attente de décision du client.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  reporte: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Reporté 📅

Le rendez-vous a été reporté à une date ultérieure.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  nouveau: `*NOUVEAU DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Nouveau 🆕

Un nouveau rendez-vous a été créé.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  annule: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Annulé

Le rendez-vous a été annulé.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  installe: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Installation terminée ✅

L'installation a été finalisée avec succès.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  paye: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Paiement reçu 💰

Le paiement a été reçu pour ce dossier.

{{comment}}

---
_Envoyé depuis DébalePro_`,
};

export const useWhatsAppNotification = () => {
  const sendWhatsAppNotification = async ({
    clientName,
    clientPrenom,
    classification,
    comment,
    r2DateTime,
    userId,
    cqTime,
    pdfData,
    regieId,
  }: SendWhatsAppParams): Promise<boolean> => {
    try {
      // Get WhatsApp contact from the régie (principal contact)
      let confirmPhone: string | null = null;
      let defaultCqTime = "10:00";
      
      if (regieId) {
        // Fetch principal contact from régie
        const { data: regieContact } = await supabase
          .from("regies_contacts")
          .select("telephone")
          .eq("regie_id", regieId)
          .eq("is_principal", true)
          .eq("actif", true)
          .maybeSingle();
        
        if (regieContact?.telephone) {
          confirmPhone = regieContact.telephone;
        }
      }
      
      // Fallback to global settings if no régie contact found
      if (!confirmPhone) {
        const { data: settings } = await supabase
          .from("settings_notifications")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!settings || !settings.whatsapp_enabled || !settings.confirmateur_phone) {
          console.log("[WhatsApp] Aucun contact WhatsApp configuré (ni régie, ni global)");
          return false;
        }
        
        confirmPhone = settings.confirmateur_phone;
        defaultCqTime = settings.default_cq_time || "10:00";
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
      const cleanPhone = confirmPhone.replace(/[+\s-]/g, "");

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

      // Calculate CQ date (next day at specified time or default 10:00)
      let cqDateStr = "";
      if (classification === "positif") {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Use provided cqTime or defaultCqTime
        const [hours, minutes] = (cqTime || defaultCqTime).split(":").map(Number);
        tomorrow.setHours(hours, minutes, 0, 0);
        cqDateStr = format(tomorrow, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
      }

      // Format comment
      const commentText = comment ? `💬 Commentaire:\n${comment}` : "";

      // Get template (custom or default)
      const templateText = customTemplate?.template_text || DEFAULT_TEMPLATES[classification] || DEFAULT_TEMPLATES.attente;

      // Replace placeholders and decode HTML entities for proper emoji display
      const message = decodeHtmlEntities(
        templateText
          .replace(/\{\{client_name\}\}/g, fullName)
          .replace(/\{\{date\}\}/g, dateStr)
          .replace(/\{\{r2_date\}\}/g, r2DateStr || "Non défini")
          .replace(/\{\{cq_date\}\}/g, cqDateStr || "Non défini")
          .replace(/\{\{comment\}\}/g, commentText)
      );

      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      // Pour r2_prestudy, partager le PDF en utilisant l'API Web Share si disponible
      if (classification === "r2_prestudy" && pdfData) {
        try {
          const pdfBlob = await getEtudePdfBlob(pdfData);
          const fileName = `Etude_${pdfData.clientNom}_${pdfData.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
          const file = new File([pdfBlob], fileName, { type: "application/pdf" });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            // Partager le PDF via Web Share API
            await navigator.share({
              files: [file],
              title: `Étude ${pdfData.clientPrenom} ${pdfData.clientNom}`,
              text: message,
            });
          } else {
            // Fallback: Télécharger le PDF et ouvrir WhatsApp
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Ouvrir WhatsApp après le téléchargement
            window.open(whatsappUrl, "_blank");
          }
        } catch (shareError) {
          console.log("[WhatsApp] Fallback vers WhatsApp classique:", shareError);
          // En cas d'erreur de partage, ouvrir WhatsApp normalement
          window.open(whatsappUrl, "_blank");
        }
      } else {
        // Open WhatsApp in new tab (comportement standard)
        window.open(whatsappUrl, "_blank");
      }

      return true;
    } catch (error) {
      console.error("[WhatsApp] Erreur:", error);
      return false;
    }
  };

  return { sendWhatsAppNotification };
};
