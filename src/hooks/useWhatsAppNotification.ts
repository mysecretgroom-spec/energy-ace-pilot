import { downloadBlob } from "@/lib/fileDelivery";
import { qNotifSettings, qRecapRdv, qRecapStudy, qRegieContact, qTemplates } from "@/lib/offline/rdvQueries";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { EtudeData } from "@/lib/exportEtudePdf";
import { formatRegieStudyDetails, studyRecapDetails, type RegieRecapDetails } from "@/lib/regieRecap";
import { signatureStudyPdf } from "@/lib/signatureStudyPdf";
import { toast as sonnerToast } from "sonner";

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
  venteDetails?: RegieRecapDetails;
  etudeId?: string | null;
  rdvId?: string;
  targetWindow?: Window | null;
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

*Compte-rendu du technicien:*
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
    pdfData: pdfDataProp,
    regieId,
    venteDetails,
    etudeId,
    rdvId,
    targetWindow,
  }: SendWhatsAppParams): Promise<boolean> => {
    // Only signatures attach the study; other statuses remain text-only.
    try {
      // Get WhatsApp contact from the régie (principal contact)
      let confirmPhone: string | null = null;
      let defaultCqTime = "10:00";
      
      if (regieId) {
        // Fetch principal contact from régie
        const { data: regieContact } = await qRegieContact(regieId);
        
        if (regieContact?.telephone) {
          confirmPhone = regieContact.telephone;
        }
      }
      
      // Fallback to global settings if no régie contact found
      if (!confirmPhone) {
        const { data: settings } = await qNotifSettings(userId);

        if (settings?.confirmateur_phone && settings?.whatsapp_enabled) {
          confirmPhone = settings.confirmateur_phone;
          defaultCqTime = settings.default_cq_time || "10:00";
        } else {
          console.log("[WhatsApp] Aucun contact WhatsApp configuré (ni régie, ni global)");
          return false;
        }
      }

      // Fetch custom template for this classification
      const { data: templates } = await qTemplates(userId);
      const customTemplate = templates?.find((t) => t.classification === classification) || null;

      // Clean phone number for wa.me link (remove + and spaces)
      const cleanPhone = confirmPhone ? confirmPhone.replace(/[+\s-]/g, "") : "";

      // Build the message using template
      const fullName = [clientPrenom, clientName].filter(Boolean).join(" ");
      const now = new Date();
      const dateStr = format(now, "dd/MM/yyyy 'à' HH:mm", { locale: fr });

      // Read the linked study even when live financial values are supplied:
      // persisted CQ and the original appointment belong to the dossier.
      const studyResult = await qRecapStudy(userId, etudeId, etudeId ? null : rdvId);
      if (studyResult.error) throw studyResult.error;
      const study = studyResult.data;
      let initialRdv = null;
      const linkedRdvId = rdvId || study?.rdv_id;
      if (linkedRdvId) {
        const readRdv = async (id: string) => {
          const result = await qRecapRdv(userId, id);
          if (result.error) throw result.error;
          return result.data;
        };
        initialRdv = await readRdv(linkedRdvId);
        if (initialRdv?.parent_rdv_id) initialRdv = await readRdv(initialRdv.parent_rdv_id) || initialRdv;
      }

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
        if (!cqDate && !cqTime && study?.cq_date_heure) {
          cqDateTime = new Date(study.cq_date_heure);
        } else if (cqDate) {
          // Parse YYYY-MM-DD as local date to avoid timezone shifts
          const [y, m, d] = cqDate.split("-").map(Number);
          cqDateTime = new Date(y, (m || 1) - 1, d || 1);
        } else {
          cqDateTime = new Date(now);
          cqDateTime.setDate(cqDateTime.getDate() + 1);
        }
        if (cqDate || cqTime || !study?.cq_date_heure) {
          const [hours, minutes] = (cqTime || defaultCqTime).split(":").map(Number);
          cqDateTime.setHours(hours, minutes, 0, 0);
        }
        cqDateStr = format(cqDateTime, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
      }

      // Format comment
      const commentText = `💬 Commentaire commercial:\n${comment || "Non renseigné"}`;

      // Get template (custom or default)
      let templateText = customTemplate?.template_text || DEFAULT_TEMPLATES[classification] || DEFAULT_TEMPLATES.attente;
      // Keep CQ first, including in custom templates that omitted it.
      if (classification === "positif") {
        templateText = templateText.replace(/^.*(?:\{\{cq_date\}\}|CQ prévu).*(?:\r?\n)?/gim, "").trim();
        templateText = `*📞 CQ prévu: {{cq_date}}*\n\n${templateText}`;
      }
      if (!templateText.includes("{{client_phone}}")) templateText += "\n\n📱 Tél: {{client_phone}}";
      if (!templateText.includes("{{client_address}}")) templateText += "\n🏠 Adresse: {{client_address}}";
      if (!templateText.includes("{{vente_details}}")) {
        templateText = templateText.includes("{{comment}}")
          ? templateText.replace("{{comment}}", "{{vente_details}}\n\n{{comment}}")
          : `${templateText}\n\n{{vente_details}}`;
      }
      if (!templateText.includes("{{comment}}")) templateText += "\n\n{{comment}}";

      let studyDetails = studyRecapDetails(pdfDataProp);
      if (!pdfDataProp && study) {
        studyDetails = {
          consommationKwh: study.consommation_annuelle_kwh ?? undefined,
          factureAnnuelleEuros: study.facture_annuelle_euros ?? undefined,
          puissanceKwc: study.puissance_kwc ?? undefined,
          prixTTC: study.prix_total ?? undefined,
          mensualiteCredit: study.mensualite_estimee ?? undefined,
          totalAides: study.total_aides ?? undefined,
          primeAutoconsommation: study.prime_autoconsommation ?? undefined,
          ecoTva: study.eco_tva ?? undefined,
        };
      }
      // Mensualité aides déduites saisie à la main dans l'étude : prime sur le prorata.
      const manualAfterAids = study?.param_overrides?.mensualiteAidesManuelle;
      if (typeof manualAfterAids === "number") studyDetails = { ...studyDetails, mensualiteApresAides: manualAfterAids };
      const details = { ...studyDetails, ...Object.fromEntries(Object.entries(venteDetails ?? {}).filter(([, value]) => value !== undefined)) };
      const venteDetailsText = formatRegieStudyDetails(details);

      // Build client address
      const originalClient = initialRdv?.clients;
      const clientAddressText = [
        initialRdv?.adresse || originalClient?.adresse || venteDetails?.adresse,
        originalClient?.code_postal || venteDetails?.codePostal,
        originalClient?.ville || venteDetails?.ville,
      ].filter(Boolean).join(", ");
      const installAddressText = [study?.adresse_installation, study?.code_postal_installation, study?.ville_installation].filter(Boolean).join(", ");
      const addressValue = installAddressText && installAddressText !== clientAddressText
        ? `${clientAddressText || "Non renseignée"}\n📍 Adresse d'installation (différente) : ${installAddressText}`
        : clientAddressText;
      const clientPhoneText = originalClient?.telephone || venteDetails?.telephone || "";

      // Replace placeholders and decode HTML entities for proper emoji display
      let message = decodeHtmlEntities(
        templateText
          .replace(/\{\{client_name\}\}/g, fullName)
          .replace(/\{\{date\}\}/g, dateStr)
          .replace(/\{\{r2_date\}\}/g, r2DateStr || "Non défini")
          .replace(/\{\{cq_date\}\}/g, cqDateStr || "Non défini")
          .replace(/\{\{comment\}\}/g, commentText)
          .replace(/\{\{vente_details\}\}/g, venteDetailsText)
          .replace(/\{\{client_phone\}\}/g, clientPhoneText || "Non renseigné")
          .replace(/\{\{client_address\}\}/g, addressValue || "Non renseignée")
      );

      // Custom templates cannot omit the requested study values or commercial comment.
      if (!templateText.includes("{{vente_details}}")) message += `\n\n${venteDetailsText}`;
      if (!templateText.includes("{{comment}}")) message += `\n\n${commentText}`;
      message = message.replace(/\*?Document PDF joint:?\*?/gi, "")
        .replace(/L'étude technique a été partagée séparément\./gi, "");
      if (classification === "positif") {
        const file = await signatureStudyPdf(userId, etudeId, rdvId, pdfDataProp);
        if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
          targetWindow?.close();
          const shareData = { files: [file], text: message, title: "Signature — étude" };
          try {
            await navigator.share(shareData);
          } catch (shareErr) {
            const name = (shareErr as DOMException)?.name;
            if (name === "AbortError") return true;
            // iOS refuse le partage après la génération du PDF (geste perdu) :
            // on propose un bouton qui relance le partage sur un nouveau tap.
            console.warn("[WhatsApp] Partage différé:", name, shareErr);
            sonnerToast("Étude prête", {
              description: file.name,
              duration: 60000,
              action: { label: "Partager", onClick: () => { navigator.share(shareData).catch(() => {}); } },
            });
          }
          return true;
        }
        if (file) {
          downloadBlob(file, file.name);
        }
      }
      // Sur mobile (surtout PWA iOS), le lien direct whatsapp:// ouvre réellement
      // l'app avec le message pré-rempli ; wa.me sert de repli sur desktop.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");
      const whatsappUrl = isMobile
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
        : `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      // iOS/PWA blocks window.open after async work (user gesture lost):
      // reuse a window pre-opened on click, else navigate the current page.
      if (targetWindow && !targetWindow.closed) {
        targetWindow.location.href = whatsappUrl;
      } else if (isMobile) {
        // En PWA, window.open est souvent bloqué : naviguer la page courante
        // déclenche l'ouverture de l'app WhatsApp via le lien direct.
        window.location.href = whatsappUrl;
      } else {
        const opened = window.open(whatsappUrl, "_blank");
        if (!opened && window.location) window.location.href = whatsappUrl;
      }
      return true;
    } catch (error) {
      console.error("[WhatsApp] Erreur:", error);
      return false;
    }
  };

  return { sendWhatsAppNotification };
};
