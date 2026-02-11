import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Classify email intent using AI - returns true only if it's an appointment/lead email
async function isAppointmentEmail(subject: string, bodyPreview: string): Promise<boolean> {
  try {
    const truncatedBody = bodyPreview.substring(0, 1500);
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
            content: `Tu es un classifieur d'emails. Tu dois déterminer si un email concerne un NOUVEAU RENDEZ-VOUS commercial ou un NOUVEAU LEAD/prospect (prise de RDV, confirmation de RDV, fiche prospect, attribution de lead).

Réponds UNIQUEMENT par "OUI" ou "NON".

OUI si l'email contient :
- Une NOUVELLE prise de rendez-vous ou confirmation de RDV
- Une fiche prospect/lead avec des coordonnées client
- Une attribution de lead commercial
- Des informations sur un client à visiter (nom, adresse, téléphone, date/heure)

NON si l'email est :
- Un suivi de vente ou changement de statut de vente (installation, pose, financement, paiement, CQ fait, livraison)
- Un email de suivi de dossier (avancement, mise à jour, modification)
- Un compte-rendu d'intervention ou de visite technique
- Un email de relance ou rappel sur un dossier existant
- Une newsletter, publicité, promotion
- Un email administratif, facture, relance paiement
- Une notification système
- Un email de support/SAV
- Un email de formation, réunion interne
- Toute communication non liée à un NOUVEAU prospect/lead`
          },
          {
            role: "user",
            content: `Sujet: ${subject}\n\nContenu:\n${truncatedBody}`
          }
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error("AI classification failed:", response.status);
      return true; // Fail open - process the email if AI fails
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content?.trim().toUpperCase() || "";
    console.log(`Intent classification for "${subject}": ${answer}`);
    return answer.startsWith("OUI");
  } catch (e) {
    console.error("Intent classification error:", e);
    return true; // Fail open
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

// Extract plain text from Gmail message payload
function extractTextFromPayload(payload: any): string {
  if (!payload) return "";

  // If it's a simple text part
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // If it's HTML without plain text alternative
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    return stripHtml(html);
  }

  // If it has parts (multipart message)
  if (payload.parts) {
    // First try to find plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Then try HTML
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return stripHtml(html);
      }
    }
    // Recursively check nested parts
    for (const part of payload.parts) {
      const text = extractTextFromPayload(part);
      if (text) return text;
    }
  }

  return "";
}

function decodeBase64Url(data: string): string {
  try {
    // Replace URL-safe characters (Gmail uses base64url encoding)
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    
    // Add padding if needed
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    
    // Decode base64 to binary string
    const binaryString = atob(padded);
    
    // Convert binary string to UTF-8
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Decode as UTF-8
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    console.error("Failed to decode base64:", e);
    // Fallback: try simple atob
    try {
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      return atob(base64);
    } catch {
      return "";
    }
  }
}

function stripHtml(html: string): string {
  // Enhanced HTML to text conversion for lead emails
  let text = html;
  
  // Step 1: Handle table structures - multiple patterns for different email formats
  // Pattern 1: <tr><td>Label:</td><td>Value</td></tr>
  text = text.replace(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi, (_, label, value) => {
    const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
    const cleanValue = value.replace(/<[^>]+>/g, "").trim();
    return `${cleanLabel} ${cleanValue}\n`;
  });
  
  // Pattern 2: <tr><td colspan="2">...</td></tr> (section headers or multi-column content)
  text = text.replace(/<tr[^>]*>\s*<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi, (_, content) => {
    return content.replace(/<[^>]+>/g, "").trim() + "\n";
  });
  
  // Pattern 3: Multiple TDs in a row
  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowContent) => {
    const cells = rowContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    const values = cells.map((cell: string) => cell.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    return values.join(" ") + "\n";
  });
  
  // Step 2: Clean remaining table tags
  text = text
    .replace(/<\/?table[^>]*>/gi, "\n")
    .replace(/<\/?tbody[^>]*>/gi, "")
    .replace(/<\/?thead[^>]*>/gi, "")
    .replace(/<\/?tfoot[^>]*>/gi, "");
  
  // Step 3: Handle other HTML structures
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    // Remove styles and scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    // Handle strong/bold
    .replace(/<\/?(?:strong|b)>/gi, "")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, " ");
  
  // Step 4: Decode HTML entities (including numeric)
  const entityMap: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&eacute;": "é",
    "&Eacute;": "É",
    "&egrave;": "è",
    "&Egrave;": "È",
    "&agrave;": "à",
    "&Agrave;": "À",
    "&acirc;": "â",
    "&Acirc;": "Â",
    "&ecirc;": "ê",
    "&Ecirc;": "Ê",
    "&icirc;": "î",
    "&Icirc;": "Î",
    "&ocirc;": "ô",
    "&Ocirc;": "Ô",
    "&ucirc;": "û",
    "&Ucirc;": "Û",
    "&euml;": "ë",
    "&Euml;": "Ë",
    "&iuml;": "ï",
    "&Iuml;": "Ï",
    "&uuml;": "ü",
    "&Uuml;": "Ü",
    "&ccedil;": "ç",
    "&Ccedil;": "Ç",
    "&oelig;": "œ",
    "&OElig;": "Œ",
    "&euro;": "€",
    "&copy;": "©",
    "&reg;": "®",
    "&deg;": "°",
    "&sup2;": "²",
    "&sup3;": "³",
  };
  
  for (const [entity, char] of Object.entries(entityMap)) {
    text = text.replace(new RegExp(entity, "g"), char);
  }
  
  // Handle numeric entities (&#233; → é)
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  // Handle hex entities (&#xE9; → é)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Step 5: Clean up whitespace
  text = text
    .replace(/[ \t]+/g, " ")           // Multiple spaces → single space
    .replace(/\n[ \t]+/g, "\n")        // Remove leading spaces on lines
    .replace(/[ \t]+\n/g, "\n")        // Remove trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n")        // Max 2 consecutive newlines
    .trim();

  return text;
}

function extractEmailAddress(from: string): string {
  // Extract email from "Name <email@domain.com>" format
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

// Interface for extracted email headers
interface EmailHeaders {
  from: string;
  replyTo: string | null;
  cc: string[];
}

// Extract all useful email headers for regie attribution
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

// Find regie by checking ALL headers simultaneously (From, Reply-To, Cc)
// Returns the first match found with a non-null regie_id
function findRegieFromHeaders(
  emailHeaders: EmailHeaders,
  emailToRegieMap: Record<string, string | null>
): { regieId: string | null; source: string } {
  // Collect all emails to check simultaneously
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
  
  // Find the first email that has a regie in the authorized list
  for (const { email, header } of emailsToCheck) {
    const regieId = emailToRegieMap[email];
    if (regieId) {
      console.log(`Regie found via ${header}: ${email}`);
      return { regieId, source: email };
    }
  }
  
  // No regie found in any header
  console.log("No regie found in any header");
  return { regieId: null, source: emailHeaders.from };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for period options
    let body: { days?: number; fromDate?: string; toDate?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Support both regular auth and service role calls with x-user-id header (for cron)
    let userId = await getUserIdFromAuth(req.headers.get("Authorization"));
    
    // If no user from auth, check for service role call with x-user-id header
    if (!userId) {
      const serviceUserId = req.headers.get("x-user-id");
      const authHeader = req.headers.get("Authorization");
      
      // Verify it's a service role key call
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

    // Get authorized emails for this user (with regie_id for auto-attribution)
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

    // Build a map of email -> regie_id for auto-attribution
    const emailToRegieMap: Record<string, string | null> = {};
    for (const e of authorizedEmails) {
      emailToRegieMap[e.email.toLowerCase()] = e.regie_id;
    }
    
    const authorizedEmailList = authorizedEmails.map(e => e.email.toLowerCase());
    console.log("Authorized emails:", authorizedEmailList);

    // Build Gmail query for authorized senders with configurable period
    const fromQuery = authorizedEmailList.map(e => `from:${e}`).join(" OR ");
    
    // Determine date filter based on provided options
    let dateFilter: string;
    if (body.fromDate && body.toDate) {
      // Custom date range: format YYYY/MM/DD
      dateFilter = `after:${body.fromDate} before:${body.toDate}`;
    } else if (body.fromDate) {
      dateFilter = `after:${body.fromDate}`;
    } else {
      // Use days parameter, default to 7 days
      const days = body.days || 7;
      dateFilter = `newer_than:${days}d`;
    }
    
    const query = `(${fromQuery}) ${dateFilter}`;
    console.log("Gmail query:", query);

    // Fetch messages from Gmail
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

    // Get already processed message IDs
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

    // Process each unprocessed message
    for (const msg of messages) {
      if (processedIds.has(msg.id)) {
        result.skipped++;
        continue;
      }

      try {
        // Fetch full message
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

        // Log all headers for debugging
        console.log(`Email headers: From=${senderEmail}, Reply-To=${emailHeaders.replyTo}, Cc=${emailHeaders.cc.join(",")}`);

        // Verify sender is authorized (From must be in authorized list)
        if (!authorizedEmailList.includes(senderEmail)) {
          console.log(`Skipping unauthorized sender: ${senderEmail}`);
          result.skipped++;
          continue;
        }

        // Extract body text
        const body = extractTextFromPayload(msgData.payload);
        // Log extracted body for debugging (first 500 chars)
        console.log(`Body preview (${body.length} chars): ${body.substring(0, 500)}...`);
        if (!body) {
          console.log(`Empty body for message ${msg.id}`);
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: "Empty email body"
          });
          
          // Still record as processed to avoid retrying
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

        // AI Intent Classification - only process appointment/lead emails
        const isAppointment = await isAppointmentEmail(subject, body);
        if (!isAppointment) {
          console.log(`Skipping non-appointment email: "${subject}"`);
          result.skipped++;
          result.details.push({
            messageId: msg.id,
            subject,
            sender: senderEmail,
            status: "skipped",
            error: "Email non lié à un rendez-vous (filtré par IA)"
          });
          
          await supabase.from("gmail_imports").insert({
            user_id: userId,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            sender_email: senderEmail,
            subject,
            status: "skipped",
            error_message: "Intent: non-RDV (filtré par IA)"
          });
          continue;
        }

        // Find regie - try From first, then Reply-To, then Cc as fallback
        const { regieId, source: regieSource } = findRegieFromHeaders(emailHeaders, emailToRegieMap);
        if (regieId && regieSource !== senderEmail) {
          console.log(`Regie attribution via fallback header: ${regieSource}`);
        }
        
        // BLOCK import if no régie found — régie is mandatory
        if (!regieId) {
          console.log(`Skipping email "${subject}" from ${senderEmail}: no régie found in any header`);
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
            error_message: "Aucune régie associée à cet expéditeur (From/Reply-To/Cc)"
          });
          continue;
        }
        
        // Call import-rdv-email to parse and create RDV
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
              body,
              user_id: userId,
              regie_id: regieId
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

        // Handle "skipped" action (duplicate active RDV)
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

        // Success!
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
