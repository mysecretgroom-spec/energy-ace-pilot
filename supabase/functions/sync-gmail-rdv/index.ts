import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * EMAIL INTENT CLASSIFICATION
 * 
 * Returns one of:
 * - "nouveau_rdv"     : New appointment for a prospect/client that does not yet exist
 * - "mise_a_jour"     : Status change on an existing appointment (installation done, payment, CQ, etc.)
 * - "report"          : Appointment rescheduled / postponed / replacement appointment
 * - "installation"    : Scheduled installation visit (technician goes to sign / check work, ~30 min)
 * - "ignore"          : Newsletter, invoice, internal notification – skip entirely
 */
type EmailIntent = "nouveau_rdv" | "mise_a_jour" | "report" | "installation" | "ignore";

async function classifyEmailIntent(subject: string, bodyPreview: string): Promise<EmailIntent> {
  try {
    const truncatedBody = bodyPreview.substring(0, 2000);
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es un classifieur d'emails pour une entreprise d'installation d'énergies renouvelables (photovoltaïque, pompe à chaleur, isolation, ballon thermodynamique).

Analyse le SUJET et le CONTENU de l'email et retourne EXACTEMENT l'un de ces mots-clés :

"nouveau_rdv" - Un NOUVEAU rendez-vous commercial (étude, visite prospect). Inclut :
  - Prise de RDV, confirmation de RDV commercial
  - Fiche prospect/lead avec coordonnées client
  - Attribution de lead ou nouveau prospect à visiter
  - ⚠️ IMPORTANT: Un email contenant un NOM + ADRESSE + DATE/HEURE de RDV est TOUJOURS un "nouveau_rdv", même si le client existe déjà dans la base (c'est un R2, un nouveau créneau, ou un renvoi par la régie). Ne le classe PAS en "mise_a_jour".

"installation" - Un rendez-vous d'INSTALLATION planifié (le jour où l'installateur pose le matériel, ou visite de conformité/signature finale). Indices :
  - Mots : "installation", "pose", "date d'installation", "rendez-vous technique", "pose du matériel", "date de pose", "technicien", "installateur", "DAT", "dossier posé"
  - L'email annonce une DATE d'installation concrète pour un dossier déjà signé/vendu
  - Peut inclure le nom du client et une adresse

"report" - Un rendez-vous REPORTÉ, ANNULÉ ou REMPLACÉ (nouveau créneau pour un RDV existant). Indices :
  - Mots : "reporté", "annulé", "reprogrammé", "déplacé", "nouveau créneau", "remplacement", "modification du RDV"

"mise_a_jour" - Mise à jour de STATUT sur un dossier existant sans créer de nouveau RDV. Exemples :
  - Confirmation d'installation réalisée, dossier finalisé, paiement reçu, financement accordé
  - Changement de statut de vente
  - CQ fait, livraison, vente annulée
  - ⚠️ NE CLASSE PAS en "mise_a_jour" si l'email contient une DATE + HEURE de rendez-vous avec un nom et une adresse → c'est un "nouveau_rdv"

"ignore" - Tout le reste :
  - Newsletter, publicité, promotion
  - Email administratif, facture, relance paiement
  - Notification système, email de formation, réunion interne
  - Support/SAV non lié à un RDV planifié

RETOURNE UNIQUEMENT le mot-clé exact, sans aucun autre texte.`,
          },
          {
            role: "user",
            content: `Sujet: ${subject}\n\nContenu:\n${truncatedBody}`,
          }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error("AI classification failed:", response.status);
      return "nouveau_rdv"; // Fail open – try to import
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    console.log(`Intent classification for "${subject}": "${answer}"`);

    if (answer.includes("installation")) return "installation";
    if (answer.includes("report")) return "report";
    if (answer.includes("mise_a_jour") || answer.includes("mise a jour")) return "mise_a_jour";
    if (answer.includes("nouveau_rdv") || answer.includes("nouveau rdv")) return "nouveau_rdv";
    if (answer.includes("ignore")) return "ignore";

    // Fallback – treat as a potential new appointment
    return "nouveau_rdv";
  } catch (e) {
    console.error("Intent classification error:", e);
    return "nouveau_rdv"; // Fail open
  }
}

/**
 * MULTI-RDV SPLITTER
 *
 * Detects emails containing several distinct appointments (numbered lists,
 * recap emails) and returns each RDV as a self-contained sub-body that can
 * be fed individually to import-rdv-email.
 *
 * Returns:
 *   - null  → not a multi-RDV email (caller uses original body)
 *   - []    → AI couldn't split (caller uses original body)
 *   - [...] → one entry per detected RDV
 */
async function splitMultiRdvEmail(subject: string, body: string): Promise<string[] | null> {
  // Heuristic pre-filter — accept many recap formats:
  //  - dates dd/mm/yyyy or dd-mm-yyyy or "12 juin"
  //  - times "09h00" / "09:00"
  //  - numbered/bulleted lists "1.", "1)", "1 -", "- ", "* "
  const dateMatches = body.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
  const frenchDates = body.match(/\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi) || [];
  const timeMatches = body.match(/\b\d{1,2}[h:]\d{2}\b/gi) || [];
  const numberedItems = body.match(/(?:^|\n)\s*(?:\d{1,2}\s*[.)\-]\s|[-*•]\s)/g) || [];
  const totalDateLike = dateMatches.length + frenchDates.length + timeMatches.length;
  if (totalDateLike < 2 && numberedItems.length < 2) return null;


  try {
    const truncated = body.substring(0, 8000);
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un extracteur d'emails de récapitulatifs de rendez-vous commerciaux.

MISSION: Si l'email contient PLUSIEURS rendez-vous distincts (liste numérotée, tableau, énumération de prospects), retourne un JSON avec chaque RDV reformaté en un bloc texte autonome contenant TOUTES les informations nécessaires (nom, prénom, adresse, code postal, ville, date, heure, téléphone, commentaires).

Si l'email ne contient qu'UN SEUL RDV ou aucun RDV exploitable, retourne {"rdvs": []}.

Format de sortie OBLIGATOIRE (JSON strict, sans markdown) :
{
  "rdvs": [
    "Nom: DUPONT\\nPrénom: Jean\\nAdresse: 12 rue de la Paix\\nCode postal: 75002\\nVille: PARIS\\nDate: 02/06/2026\\nHeure: 14:00\\nTéléphone: 0612345678\\nCommentaire: ...",
    "Nom: MARTIN\\nPrénom: Sophie\\n..."
  ]
}

Règles :
- Chaque bloc DOIT être autonome (ne fait pas référence aux autres RDV).
- Ne fusionne JAMAIS deux clients dans un même bloc.
- Si une info manque pour un RDV, ne mets pas le champ.
- Retourne au minimum 2 entrées, sinon retourne {"rdvs": []}.`,
          },
          {
            role: "user",
            content: `Sujet: ${subject}\n\nContenu:\n${truncated}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("Multi-RDV split AI failed:", response.status);
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) content = jsonMatch[1].trim();

    const parsed = JSON.parse(content);
    const rdvs: unknown = parsed?.rdvs;
    if (!Array.isArray(rdvs)) return null;
    const valid = rdvs.filter((r): r is string => typeof r === "string" && r.trim().length > 20);
    if (valid.length < 2) return null;
    console.log(`Multi-RDV detected: ${valid.length} appointments in "${subject}"`);
    return valid;
  } catch (e) {
    console.error("Multi-RDV split error:", e);
    return null;
  }
}

interface SyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<{
    messageId: string;
    subject: string;
    sender: string;
    status: "imported" | "updated" | "skipped" | "error";
    error?: string;
    rdvId?: string;
  }>;
}

// Extract all content parts from Gmail message payload (text, html, ical)
interface ExtractedContent {
  text: string;
  rawHtml: string;
  icalData: string;
}

function extractAllContentFromPayload(payload: any, messageId?: string): ExtractedContent {
  const result: ExtractedContent = { text: "", rawHtml: "", icalData: "" };
  // Clear pending attachments from previous message
  pendingAttachments.length = 0;
  collectParts(payload, result, messageId);

  // If no plain text, derive from HTML
  if (!result.text && result.rawHtml) {
    result.text = stripHtml(result.rawHtml);
  }

  return result;
}

// Pending attachment fetches (populated during collectParts, resolved after)
interface PendingAttachment {
  attachmentId: string;
  messageId: string;
  mimeType: string;
  filename: string;
}

const pendingAttachments: PendingAttachment[] = [];

function collectParts(part: any, result: ExtractedContent, messageId?: string): void {
  if (!part) return;

  const mime = part.mimeType || "";
  const data = part.body?.data;
  const attachmentId = part.body?.attachmentId;

  if (data) {
    if (mime === "text/plain" && !result.text) {
      result.text = decodeBase64Url(data);
    } else if (mime === "text/html" && !result.rawHtml) {
      result.rawHtml = decodeBase64Url(data);
    } else if (mime === "text/calendar" || mime.includes("calendar")) {
      result.icalData += decodeBase64Url(data) + "\n";
    }
  }

  // Also check attachments with .ics filename (inline data)
  if (part.filename && part.filename.endsWith(".ics") && data) {
    result.icalData += decodeBase64Url(data) + "\n";
  }

  // Queue attachment fetch if data is NOT inline but attachmentId exists
  if (!data && attachmentId && messageId) {
    const isCalendar = mime === "text/calendar" || mime.includes("calendar") || 
                       (part.filename && part.filename.endsWith(".ics"));
    if (isCalendar) {
      pendingAttachments.push({ attachmentId, messageId, mimeType: mime, filename: part.filename || "" });
    }
  }

  if (part.parts) {
    for (const subpart of part.parts) {
      collectParts(subpart, result, messageId);
    }
  }
}

async function fetchPendingAttachments(accessToken: string, result: ExtractedContent): Promise<void> {
  for (const att of pendingAttachments) {
    try {
      const attResponse = await fetch(
        `${GMAIL_API_BASE}/users/me/messages/${att.messageId}/attachments/${att.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (attResponse.ok) {
        const attData = await attResponse.json();
        if (attData.data) {
          const decoded = decodeBase64Url(attData.data);
          result.icalData += decoded + "\n";
          console.log(`Fetched .ics attachment (${decoded.length} chars) for message ${att.messageId}`);
        }
      } else {
        console.error(`Failed to fetch attachment ${att.attachmentId}: ${attResponse.status}`);
      }
    } catch (e) {
      console.error(`Error fetching attachment ${att.attachmentId}:`, e);
    }
  }
  // Clear for next message
  pendingAttachments.length = 0;
}

// Parse iCal VEVENT data into key-value text
function parseICalToText(icalData: string): string {
  if (!icalData.trim()) return "";

  const lines: string[] = [];

  // Unfold iCal line continuations (lines starting with space/tab)
  const unfolded = icalData.replace(/\r?\n[ \t]/g, "");

  // Extract ALL VEVENT blocks (some emails have multiple)
  const veventMatches = [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi)];
  const contents = veventMatches.length > 0 
    ? veventMatches.map(m => m[1]) 
    : [unfolded];

  const fieldMap: Record<string, string> = {
    "SUMMARY": "Résumé",
    "DESCRIPTION": "Description",
    "LOCATION": "Lieu",
    "DTSTART": "Date début",
    "DTEND": "Date fin",
    "ATTENDEE": "Participant",
    "ORGANIZER": "Organisateur",
    "COMMENT": "Commentaire",
    "CONTACT": "Contact",
    "X-ALT-DESC": "Description HTML",
    "X-COMMENT": "Commentaire",
    "X-PHONE": "Téléphone",
    "X-TEL": "Téléphone",
    "X-MOBILE": "Mobile",
  };

  for (const content of contents) {
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("BEGIN:") || trimmed.startsWith("END:")) continue;

      // Handle properties with params like DTSTART;TZID=...:value
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      let propFull = trimmed.substring(0, colonIdx);
      let value = trimmed.substring(colonIdx + 1);

      // Strip parameters (e.g., DTSTART;TZID=Europe/Paris → DTSTART)
      const semiIdx = propFull.indexOf(";");
      const propName = (semiIdx !== -1 ? propFull.substring(0, semiIdx) : propFull).toUpperCase();

      // Decode escaped chars
      value = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\");

      // For X-ALT-DESC (HTML description), strip HTML tags
      if (propName === "X-ALT-DESC") {
        value = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }

      const label = fieldMap[propName];
      if (label && value.trim()) {
        lines.push(`${label}: ${value.trim()}`);
      }
    }

    // Extract phone numbers from the full iCal content (all formats)
    const phonePatterns = [
      // French formats with labels
      /(?:tel|tél|telephone|téléphone|portable|mobile|phone|gsm|fixe|num)\s*[:=]?\s*(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/gi,
      // Standalone French phone numbers
      /(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g,
      // International format
      /\+\d{2,3}[\s.-]?\d[\s.-]?\d{2}(?:[\s.-]?\d{2}){3}/g,
    ];

    for (const pattern of phonePatterns) {
      const phoneMatches = content.matchAll(pattern);
      for (const match of phoneMatches) {
        const phone = match[0].trim();
        if (!lines.some(l => l.includes(phone))) {
          lines.push(`Téléphone (iCal): ${phone}`);
        }
      }
    }
  }

  return lines.length > 0 ? "\n--- DONNÉES AGENDA (iCal) ---\n" + lines.join("\n") : "";
}

// Legacy wrapper for backward compatibility
function extractTextFromPayload(payload: any): string {
  return extractAllContentFromPayload(payload).text;
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binaryString = atob(padded);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    console.error("Failed to decode base64:", e);
    try {
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      return atob(base64);
    } catch {
      return "";
    }
  }
}

function stripHtml(html: string): string {
  let text = html;

  // Extract hidden data BEFORE stripping HTML: hidden inputs, display:none elements
  const hiddenData: string[] = [];

  // Hidden input fields (often contain phone, comments, IDs)
  const hiddenInputs = html.matchAll(/<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi);
  for (const match of hiddenInputs) {
    const nameMatch = match[0].match(/name\s*=\s*["']([^"']+)["']/i);
    const valueMatch = match[0].match(/value\s*=\s*["']([^"']+)["']/i);
    if (nameMatch && valueMatch && valueMatch[1].trim()) {
      hiddenData.push(`${nameMatch[1]}: ${valueMatch[1]}`);
    }
  }

  // Elements with display:none that may contain data
  const hiddenElements = html.matchAll(/<[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi);
  for (const match of hiddenElements) {
    const content = match[1].replace(/<[^>]+>/g, "").trim();
    if (content && content.length > 2 && content.length < 500) {
      hiddenData.push(content);
    }
  }

  // data-* attributes that may contain structured info
  const dataAttrs = html.matchAll(/data-(phone|tel|telephone|mobile|comment|commentaire|nom|prenom|name|address|adresse)\s*=\s*["']([^"']+)["']/gi);
  for (const match of dataAttrs) {
    if (match[2].trim()) {
      hiddenData.push(`${match[1]}: ${match[2]}`);
    }
  }

  // Extract tel: links (often contain phone numbers)
  const telLinks = html.matchAll(/<a[^>]*href\s*=\s*["']tel:([^"']+)["'][^>]*>/gi);
  for (const match of telLinks) {
    const phone = match[1].replace(/[^\d+]/g, "").trim();
    if (phone.length >= 10) {
      hiddenData.push(`Téléphone (lien): ${phone}`);
    }
  }

  // Extract mailto: links for client email
  const mailtoLinks = html.matchAll(/<a[^>]*href\s*=\s*["']mailto:([^"'?]+)["'?][^>]*>/gi);
  for (const match of mailtoLinks) {
    const email = match[1].trim();
    if (email.includes("@") && !email.includes("unsubscribe")) {
      hiddenData.push(`Email (lien): ${email}`);
    }
  }

  // ── PHONE EXTRACTION FROM HTML TABLE CELLS ────────────────────────────────
  // Detect patterns like <td>Téléphone</td><td>06 12 34 56 78</td>
  // Also handles <th>/<td>, <b>Tél:</b>, spans, etc.
  const phoneLabels = /(?:t[ée]l[ée]?phone|portable|mobile|gsm|num[ée]ro|t[ée]l|phone|fixe|cell)/i;
  
  // Match table rows containing phone labels
  const tablePhonePatterns = [
    // <td>Label</td><td>Value</td> (with possible nested tags)
    /<t[dh][^>]*>[\s\S]*?(?:t[ée]l[ée]?phone|portable|mobile|gsm|num[ée]ro|t[ée]l|phone|fixe)[\s\S]*?<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi,
    // <b>Label:</b> Value or <strong>Label:</strong> Value in same cell
    /<(?:b|strong)[^>]*>[\s]*(?:t[ée]l[ée]?phone|portable|mobile|gsm|t[ée]l|phone|fixe)[\s]*:?[\s]*<\/(?:b|strong)>\s*([\s\S]*?)(?:<(?:br|\/td|\/p|\/div|\/li))/gi,
    // <span>Label</span><span>Value</span>
    /<span[^>]*>[\s\S]*?(?:t[ée]l[ée]?phone|portable|mobile|gsm|t[ée]l)[\s\S]*?<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/gi,
  ];

  for (const pattern of tablePhonePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const rawValue = match[1].replace(/<[^>]+>/g, "").trim();
      // Check if it looks like a phone number (has enough digits)
      const digits = rawValue.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        hiddenData.push(`Téléphone (tableau): ${rawValue}`);
      }
    }
  }

  // ── GLOBAL PHONE NUMBER SWEEP FROM HTML ─────────────────────────────────
  // Find ALL phone numbers in the raw HTML that might be near phone labels
  const phoneContextPattern = /(?:t[ée]l[ée]?phone|portable|mobile|gsm|num[ée]ro|t[ée]l|phone|fixe)\s*(?::|\s|<[^>]*>)*\s*(?:<[^>]*>)*\s*((?:\+33|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4})/gi;
  const contextPhones = html.matchAll(phoneContextPattern);
  for (const match of contextPhones) {
    const phone = match[1].trim();
    if (!hiddenData.some(d => d.includes(phone.replace(/\D/g, "").slice(-8)))) {
      hiddenData.push(`Téléphone (contexte HTML): ${phone}`);
    }
  }

  text = text.replace(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi, (_, label, value) => {
    const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
    const cleanValue = value.replace(/<[^>]+>/g, "").trim();
    return `${cleanLabel} ${cleanValue}\n`;
  });

  text = text.replace(/<tr[^>]*>\s*<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi, (_, content) => {
    return content.replace(/<[^>]+>/g, "").trim() + "\n";
  });

  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowContent) => {
    const cells = rowContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    const values = cells.map((cell: string) => cell.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    return values.join(" ") + "\n";
  });

  text = text
    .replace(/<\/?table[^>]*>/gi, "\n")
    .replace(/<\/?tbody[^>]*>/gi, "")
    .replace(/<\/?thead[^>]*>/gi, "")
    .replace(/<\/?tfoot[^>]*>/gi, "");

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?(?:strong|b)>/gi, "")
    .replace(/<[^>]+>/g, " ");

  const entityMap: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&#39;": "'", "&apos;": "'", "&eacute;": "é", "&Eacute;": "É",
    "&egrave;": "è", "&Egrave;": "È", "&agrave;": "à", "&Agrave;": "À",
    "&acirc;": "â", "&Acirc;": "Â", "&ecirc;": "ê", "&Ecirc;": "Ê",
    "&icirc;": "î", "&Icirc;": "Î", "&ocirc;": "ô", "&Ocirc;": "Ô",
    "&ucirc;": "û", "&Ucirc;": "Û", "&euml;": "ë", "&Euml;": "Ë",
    "&iuml;": "ï", "&Iuml;": "Ï", "&uuml;": "ü", "&Uuml;": "Ü",
    "&ccedil;": "ç", "&Ccedil;": "Ç", "&oelig;": "œ", "&OElig;": "Œ",
    "&euro;": "€", "&copy;": "©", "&reg;": "®", "&deg;": "°",
    "&sup2;": "²", "&sup3;": "³",
  };

  for (const [entity, char] of Object.entries(entityMap)) {
    text = text.replace(new RegExp(entity, "g"), char);
  }

  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Append hidden data if found
  if (hiddenData.length > 0) {
    text += "\n\n--- DONNÉES MASQUÉES (HTML) ---\n" + hiddenData.join("\n");
  }

  return text;
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

interface EmailHeaders {
  from: string;
  replyTo: string | null;
  cc: string[];
}

function extractAllEmailHeaders(headers: any[]): EmailHeaders {
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const fromRaw = getHeader("From");
  const replyToRaw = getHeader("Reply-To");
  const ccRaw = getHeader("Cc");

  return {
    from: extractEmailAddress(fromRaw),
    replyTo: replyToRaw ? extractEmailAddress(replyToRaw) : null,
    cc: ccRaw
      ? ccRaw.split(",").map((e: string) => extractEmailAddress(e.trim())).filter(Boolean)
      : []
  };
}

function findRegieFromHeaders(
  emailHeaders: EmailHeaders,
  emailToRegieMap: Record<string, string | null>
): { regieId: string | null; source: string } {
  const emailsToCheck: Array<{ email: string; header: string }> = [
    { email: emailHeaders.from, header: "From" }
  ];
  if (emailHeaders.replyTo) {
    emailsToCheck.push({ email: emailHeaders.replyTo, header: "Reply-To" });
  }
  for (const cc of emailHeaders.cc) {
    emailsToCheck.push({ email: cc, header: "Cc" });
  }

  console.log(`Checking ${emailsToCheck.length} emails for regie: ${emailsToCheck.map(e => `${e.header}:${e.email}`).join(", ")}`);

  for (const { email, header } of emailsToCheck) {
    const regieId = emailToRegieMap[email];
    if (regieId) {
      console.log(`Regie found via ${header}: ${email}`);
      return { regieId, source: email };
    }
  }

  console.log("No regie found in any header");
  return { regieId: null, source: emailHeaders.from };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { days?: number; fromDate?: string; toDate?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON, use defaults
    }

    let userId = await getUserIdFromAuth(req.headers.get("Authorization"));

    if (!userId) {
      const serviceUserId = req.headers.get("x-user-id");
      const authHeader = req.headers.get("Authorization");
      if (serviceUserId && authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY)) {
        userId = serviceUserId;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google not connected", code: "GOOGLE_NOT_CONNECTED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: authorizedEmails, error: emailsError } = await supabase
      .from("emails_autorises")
      .select("email, regie_id")
      .eq("user_id", userId)
      .eq("actif", true);

    if (emailsError || !authorizedEmails?.length) {
      return new Response(
        JSON.stringify({
          error: "No authorized emails configured",
          code: "NO_AUTHORIZED_EMAILS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailToRegieMap: Record<string, string | null> = {};
    for (const e of authorizedEmails) {
      emailToRegieMap[e.email.toLowerCase()] = e.regie_id;
    }

    const authorizedEmailList = authorizedEmails.map(e => e.email.toLowerCase());
    console.log("Authorized emails:", authorizedEmailList);

    const fromQuery = authorizedEmailList.map(e => `from:${e}`).join(" OR ");

    let dateFilter: string;
    if (body.fromDate && body.toDate) {
      dateFilter = `after:${body.fromDate} before:${body.toDate}`;
    } else if (body.fromDate) {
      dateFilter = `after:${body.fromDate}`;
    } else {
      const days = body.days || 7;
      dateFilter = `newer_than:${days}d`;
    }

    const query = `(${fromQuery}) ${dateFilter}`;
    console.log("Gmail query:", query);

    const listResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      const error = await listResponse.text();
      console.error("Gmail list error:", error);
      throw new Error("Failed to fetch emails from Gmail");
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];
    console.log(`Found ${messages.length} messages`);

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          details: [],
          message: "No new emails from authorized senders"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: processedMessages } = await supabase
      .from("gmail_imports")
      .select("gmail_message_id")
      .eq("user_id", userId)
      .in("gmail_message_id", messages.map((m: any) => m.id));

    const processedIds = new Set(processedMessages?.map(m => m.gmail_message_id) || []);
    console.log(`Already processed: ${processedIds.size} messages`);

    const result: SyncResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const msg of messages) {
      if (processedIds.has(msg.id)) {
        result.skipped++;
        continue;
      }

      try {
        const msgResponse = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!msgResponse.ok) {
          console.error(`Failed to fetch message ${msg.id}`);
          result.errors++;
          result.details.push({
            messageId: msg.id,
            subject: "Unknown",
            sender: "Unknown",
            status: "error",
            error: "Failed to fetch message"
          });
          continue;
        }

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];

        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
        const emailHeaders = extractAllEmailHeaders(headers);
        const senderEmail = emailHeaders.from;

        console.log(`Email headers: From=${senderEmail}, Reply-To=${emailHeaders.replyTo}, Cc=${emailHeaders.cc.join(",")}`);

        if (!authorizedEmailList.includes(senderEmail)) {
          console.log(`Skipping unauthorized sender: ${senderEmail}`);
          result.skipped++;
          continue;
        }

        const allContent = extractAllContentFromPayload(msgData.payload, msg.id);
        
        // Fetch any .ics attachments that weren't inline
        if (pendingAttachments.length > 0) {
          console.log(`Fetching ${pendingAttachments.length} .ics attachment(s) for message ${msg.id}...`);
          await fetchPendingAttachments(accessToken, allContent);
        }
        
        const icalText = parseICalToText(allContent.icalData);
        
        // Combine all sources: plain text + iCal data for maximum extraction
        const emailBody = (allContent.text + icalText).trim();
        console.log(`Body preview (${emailBody.length} chars, ical=${allContent.icalData.length > 0}): ${emailBody.substring(0, 300)}...`);

        if (!emailBody) {
          console.log(`Empty body for message ${msg.id}`);
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: "Empty email body"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: "Empty email body"
          });
          continue;
        }

        console.log(`Processing: ${subject} from ${senderEmail}`);

        // ── INTENT CLASSIFICATION ──────────────────────────────────────────
        const intent = await classifyEmailIntent(subject, emailBody);
        console.log(`Intent for "${subject}": ${intent}`);

        // Skip irrelevant emails
        if (intent === "ignore" || intent === "mise_a_jour") {
          const reason = intent === "ignore"
            ? "Email non lié à un RDV (newsletter/admin)"
            : "Mise à jour de statut – pas de nouveau RDV créé";

          console.log(`Skipping (${intent}): "${subject}"`);
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: reason
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: reason
          });
          continue;
        }

        // ── REGIE LOOKUP ───────────────────────────────────────────────────
        const { regieId, source: regieSource } = findRegieFromHeaders(emailHeaders, emailToRegieMap);
        if (regieId && regieSource !== senderEmail) {
          console.log(`Regie attribution via fallback header: ${regieSource}`);
        }

        if (!regieId) {
          console.log(`Skipping "${subject}" from ${senderEmail}: no régie found`);
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: "Aucune régie associée à cet expéditeur"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: "Aucune régie associée (From/Reply-To/Cc)"
          });
          continue;
        }

        // ── MULTI-RDV DETECTION ────────────────────────────────────────────
        // Some emails (recaps, planning summaries from régies) list several
        // appointments in a single message. Split them and dispatch each one.
        const subBodies = intent === "nouveau_rdv"
          ? await splitMultiRdvEmail(subject, emailBody)
          : null;
        const bodiesToImport: string[] = subBodies && subBodies.length >= 2
          ? subBodies
          : [emailBody];

        let anySuccess = false;
        let lastSkipReason: string | null = null;
        let lastError: string | null = null;
        const createdRdvIds: string[] = [];
        const createdClientIds: string[] = [];
        let perItemImported = 0;
        let perItemUpdated = 0;
        let perItemSkipped = 0;
        let perItemErrors = 0;

        for (let i = 0; i < bodiesToImport.length; i++) {
          const currentBody = bodiesToImport[i];
          const currentSubject = bodiesToImport.length > 1
            ? `${subject} (RDV ${i + 1}/${bodiesToImport.length})`
            : subject;

          // ── DISPATCH TO IMPORT FUNCTION ──────────────────────────────────
          const importResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/import-rdv-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({
                sender_email: senderEmail,
                subject: currentSubject,
                body: currentBody,
                user_id: userId,
                regie_id: regieId,
                intent,
              })
            }
          );

          const importResult = await importResponse.json();
          console.log(`Import result [${i + 1}/${bodiesToImport.length}]:`, importResult);

          if (!importResponse.ok || !importResult.success) {
            perItemErrors++;
            lastError = importResult.error || "Import failed";
            continue;
          }

          if (importResult.action === "skipped") {
            perItemSkipped++;
            lastSkipReason = importResult.reason || "RDV existant";
            if (importResult.client_id) createdClientIds.push(importResult.client_id);
            continue;
          }

          anySuccess = true;
          if (importResult.action === "created") perItemImported++;
          else perItemUpdated++;
          if (importResult.rdv_id) createdRdvIds.push(importResult.rdv_id);
          if (importResult.client_id) createdClientIds.push(importResult.client_id);
        }

        // ── AGGREGATE RESULTS FOR THIS EMAIL ───────────────────────────────
        result.imported += perItemImported;
        result.updated += perItemUpdated;

        if (bodiesToImport.length > 1) {
          // Multi-RDV email: log a summary line
          const summary = `Multi-RDV: ${perItemImported} créé(s), ${perItemUpdated} mis à jour, ${perItemSkipped} ignoré(s), ${perItemErrors} erreur(s)`;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: anySuccess ? "imported" : (perItemErrors > 0 ? "error" : "skipped"),
            error: anySuccess ? undefined : (lastError || lastSkipReason || summary),
            rdvId: createdRdvIds[0],
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: anySuccess ? "processed" : (perItemErrors > 0 ? "error" : "skipped"),
            error_message: anySuccess ? summary : (lastError || lastSkipReason || summary),
            rdv_id: createdRdvIds[0] || null,
            client_id: createdClientIds[0] || null,
          });
          if (!anySuccess) {
            if (perItemErrors > 0) result.errors++;
            else result.skipped++;
          }
          continue;
        }

        // Single-RDV email: preserve previous per-message reporting
        if (perItemErrors > 0) {
          result.errors++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "error",
            error: lastError || "Import failed"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "error",
            error_message: lastError || "Import failed"
          });
          continue;
        }

        if (perItemSkipped > 0 && !anySuccess) {
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: lastSkipReason || "RDV existant"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: lastSkipReason || "RDV existant",
            client_id: createdClientIds[0] || null,
          });
          continue;
        }

        const action = perItemImported > 0 ? "imported" : "updated";
        result.details.push({
          messageId: msg.id,
          subject,
          sender: senderEmail,
          status: action,
          rdvId: createdRdvIds[0],
        });

        await supabase.from("gmail_imports").insert({
          user_id: userId,
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          sender_email: senderEmail,
          subject,
          status: "processed",
          rdv_id: createdRdvIds[0] || null,
          client_id: createdClientIds[0] || null,
        });

      } catch (error) {
        console.error(`Error processing message ${msg.id}:`, error);
        result.errors++;
        result.details.push({
          messageId: msg.id,
          subject: "Unknown",
          sender: "Unknown",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    console.log("Sync complete:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
