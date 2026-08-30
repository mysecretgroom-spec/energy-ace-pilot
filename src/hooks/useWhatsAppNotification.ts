import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EtudeData, getEtudePdfBlob } from "@/lib/exportEtudePdf";

interface VenteDetails {
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
}

interface SendWhatsAppParams {
  clientName: string;
  clientPrenom?: string;
  classification: string;
  comment?: string;
  r2DateTime?: string | null;
  userId: string;
  cqTime?: string;
  cqDate?: string; // YYYY-MM-DD; defaults to tomorrow when omitted
  pdfData?: EtudeData;
  regieId?: string | null;
  venteDetails?: VenteDetails;
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
  positif: `*📞 CQ prévu: {{cq_date}}*

---

*🎉 NOUVELLE VENTE SIGNÉE*

👤 Client: *{{client_name}}*
📱 Tél: {{client_phone}}
🏠 Adresse: {{client_address}}
📅 Date: {{date}}

{{vente_details}}

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
Statut: Installation terminée

L'installation a été finalisée avec succès.

{{comment}}

---
_Envoyé depuis DébalePro_`,

  paye: `*MISE À JOUR DOSSIER*

Client: *{{client_name}}*
Date: {{date}}
Statut: Paiement reçu

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
    cqDate,
    pdfData,
    regieId,
    venteDetails,
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

        if (settings?.confirmateur_phone && settings?.whatsapp_enabled) {
          confirmPhone = settings.confirmateur_phone;
          defaultCqTime = settings.default_cq_time || "10:00";
        } else {
          // No phone configured - allow PDF sharing via Web Share API for pre-study/positif
          if ((classification === "positif" || classification === "r2_prestudy") && pdfData) {
            console.log("[WhatsApp] Pas de confirmateur configuré, partage PDF via Web Share API");
          } else {
            console.log("[WhatsApp] Aucun contact WhatsApp configuré (ni régie, ni global)");
            return false;
          }
        }
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
      const cleanPhone = confirmPhone ? confirmPhone.replace(/[+\s-]/g, "") : "";

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

      // Calculate CQ date — uses provided cqDate or defaults to tomorrow
      let cqDateStr = "";
      if (classification === "positif") {
        let cqDateTime: Date;
        if (cqDate) {
          // Parse YYYY-MM-DD as local date to avoid timezone shifts
          const [y, m, d] = cqDate.split("-").map(Number);
          cqDateTime = new Date(y, (m || 1) - 1, d || 1);
        } else {
          cqDateTime = new Date(now);
          cqDateTime.setDate(cqDateTime.getDate() + 1);
        }
        const [hours, minutes] = (cqTime || defaultCqTime).split(":").map(Number);
        cqDateTime.setHours(hours, minutes, 0, 0);
        cqDateStr = format(cqDateTime, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
      }

      // Format comment
      const commentText = comment ? `💬 Commentaire:\n${comment}` : "";

      // Get template (custom or default)
      const templateText = customTemplate?.template_text || DEFAULT_TEMPLATES[classification] || DEFAULT_TEMPLATES.attente;

      // Build vente details block
      let venteDetailsText = "";
      if (venteDetails) {
        const parts: string[] = [];
        if (venteDetails.puissanceKwc) parts.push(`⚡ Puissance: *${venteDetails.puissanceKwc} kWc*`);
        if (venteDetails.prixTTC) parts.push(`💰 Prix: *${venteDetails.prixTTC.toLocaleString("fr-FR")}€ TTC*`);
        if (venteDetails.totalAides) parts.push(`🏛️ Total aides: *${venteDetails.totalAides.toLocaleString("fr-FR")}€*`);
        if (venteDetails.primeAutoconsommation) parts.push(`☀️ Prime Coup de Pouce Producteur: ${venteDetails.primeAutoconsommation.toLocaleString("fr-FR")}€`);
        if (venteDetails.ecoTva) parts.push(`📊 ECO TVA: ${venteDetails.ecoTva.toLocaleString("fr-FR")}€`);
        if (venteDetails.productType) parts.push(`🔧 Type: ${venteDetails.productType}`);
        venteDetailsText = parts.join("\n");
      }

      // Build client address
      const clientAddressText = venteDetails 
        ? [venteDetails.adresse, venteDetails.codePostal, venteDetails.ville].filter(Boolean).join(", ")
        : "";
      const clientPhoneText = venteDetails?.telephone || "";

      // Replace placeholders and decode HTML entities for proper emoji display
      const message = decodeHtmlEntities(
        templateText
          .replace(/\{\{client_name\}\}/g, fullName)
          .replace(/\{\{date\}\}/g, dateStr)
          .replace(/\{\{r2_date\}\}/g, r2DateStr || "Non défini")
          .replace(/\{\{cq_date\}\}/g, cqDateStr || "Non défini")
          .replace(/\{\{comment\}\}/g, commentText)
          .replace(/\{\{vente_details\}\}/g, venteDetailsText)
          .replace(/\{\{client_phone\}\}/g, clientPhoneText || "Non renseigné")
          .replace(/\{\{client_address\}\}/g, clientAddressText || "Non renseignée")
      );

      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMessage}` : null;

      // Partager le PDF pour "positif" et "r2_prestudy" via Web Share API
      if ((classification === "positif" || classification === "r2_prestudy") && pdfData) {
        let pdfBlob: Blob;
        let fileName: string;
        try {
          pdfBlob = await getEtudePdfBlob(pdfData);
          fileName = `Etude_${pdfData.clientNom}_${pdfData.clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
        } catch (pdfErr) {
          console.error("[WhatsApp] Erreur génération PDF:", pdfErr);
          // Fallback: ouvrir WhatsApp sans PDF si possible
          if (whatsappUrl) {
            window.open(whatsappUrl, "_blank");
            return true;
          }
          return false;
        }

        const file = new File([pdfBlob], fileName, { type: "application/pdf" });
        const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));

        if (canShareFiles) {
          // Partager via le partage natif (l'utilisateur choisit WhatsApp ou autre)
          try {
            await navigator.share({
              files: [file],
              title: `Étude ${pdfData.clientPrenom} ${pdfData.clientNom}`,
              text: message,
            });
            return true;
          } catch (shareError: any) {
            // L'utilisateur a annulé le partage natif → ne pas mentir avec un toast succès
            if (shareError?.name === "AbortError") {
              console.log("[WhatsApp] Partage natif annulé par l'utilisateur");
              return false;
            }
            console.warn("[WhatsApp] Échec partage natif, fallback:", shareError);
            // Fallback: télécharger + ouvrir WhatsApp
          }
        }

        // Fallback: télécharger le PDF puis ouvrir WhatsApp si dispo
        try {
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (dlErr) {
          console.error("[WhatsApp] Échec téléchargement PDF:", dlErr);
        }

        if (whatsappUrl) {
          window.open(whatsappUrl, "_blank");
        }
        return true;
      } else if (whatsappUrl) {
        // Open WhatsApp in new tab (comportement standard)
        window.open(whatsappUrl, "_blank");
        return true;
      }

      // Aucun canal disponible
      console.warn("[WhatsApp] Aucun canal de partage disponible (ni PDF, ni numéro)");
      return false;
    } catch (error) {
      console.error("[WhatsApp] Erreur:", error);
      return false;
    }
  };

  return { sendWhatsAppNotification };
};
