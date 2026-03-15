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

"nouveau_rdv" - Un NOUVEAU rendez-vous commercial (étude, visite prospect) pour un client qui n'existe pas encore. Inclut :
  - Prise de RDV, confirmation de RDV commercial
  - Fiche prospect/lead avec coordonnées client
  - Attribution de lead ou nouveau prospect à visiter

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

function extractAllContentFromPayload(payload: any): ExtractedContent {
  const result: ExtractedContent = { text: "", rawHtml: "", icalData: "" };
  collectParts(payload, result);

  // If no plain text, derive from HTML
  if (!result.text && result.rawHtml) {
    result.text = stripHtml(result.rawHtml);
  }

  return result;
}

function collectParts(part: any, result: ExtractedContent): void {
  if (!part) return;

  const mime = part.mimeType || "";
  const data = part.body?.data;

  if (data) {
    if (mime === "text/plain" && !result.text) {
      result.text = decodeBase64Url(data);
    } else if (mime === "text/html" && !result.rawHtml) {
      result.rawHtml = decodeBase64Url(data);
    } else if (mime === "text/calendar" || mime.includes("calendar")) {
      result.icalData += decodeBase64Url(data) + "\n";
    }
  }

  // Also check attachments with .ics filename
  if (part.filename && part.filename.endsWith(".ics") && data) {
    result.icalData += decodeBase64Url(data) + "\n";
  }

  if (part.parts) {
    for (const subpart of part.parts) {
      collectParts(subpart, result);
    }
  }
}

// Parse iCal VEVENT data into key-value text
function parseICalToText(icalData: string): string {
  if (!icalData.trim()) return "";

  const lines: string[] = [];

  // Unfold iCal line continuations (lines starting with space/tab)
  const unfolded = icalData.replace(/\r?\n[ \t]/g, "");

  // Extract VEVENT block
  const veventMatch = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/i);
  const content = veventMatch ? veventMatch[1] : unfolded;

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
  };

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

    const label = fieldMap[propName];
    if (label && value.trim()) {
      lines.push(`${label}: ${value.trim()}`);
    }
  }

  // Extract phone numbers from DESCRIPTION or any field
  const phoneMatches = content.match(/(?:(?:tel|tél|telephone|téléphone|portable|mobile|phone)\s*[:=]?\s*)?(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/gi);
  if (phoneMatches) {
    for (const phone of phoneMatches) {
      if (!lines.some(l => l.includes(phone.trim()))) {
        lines.push(`Téléphone (iCal): ${phone.trim()}`);
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

        const emailBody = extractTextFromPayload(msgData.payload);
        console.log(`Body preview (${emailBody.length} chars): ${emailBody.substring(0, 300)}...`);

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

        // ── DISPATCH TO IMPORT FUNCTION ────────────────────────────────────
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
              subject,
              body: emailBody,
              user_id: userId,
              regie_id: regieId,
              intent, // "nouveau_rdv" | "report" | "installation"
            })
          }
        );

        const importResult = await importResponse.json();
        console.log("Import result:", importResult);

        if (!importResponse.ok || !importResult.success) {
          result.errors++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "error",
            error: importResult.error || "Import failed"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "error",
            error_message: importResult.error || "Import failed"
          });
          continue;
        }

        if (importResult.action === "skipped") {
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: importResult.reason || "RDV existant"
          });
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: importResult.reason || "RDV existant",
            client_id: importResult.client_id
          });
          continue;
        }

        // Success
        const action = importResult.action === "created" ? "imported" : "updated";
        if (action === "imported") result.imported++;
        else result.updated++;

        result.details.push({
          messageId: msg.id,
          subject,
          sender: senderEmail,
          status: action,
          rdvId: importResult.rdv_id
        });

        await supabase.from("gmail_imports").insert({
          user_id: userId,
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          sender_email: senderEmail,
          subject,
          status: "processed",
          rdv_id: importResult.rdv_id,
          client_id: importResult.client_id
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
