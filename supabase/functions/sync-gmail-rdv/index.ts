import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
    // Replace URL-safe characters
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    // Decode
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch (e) {
    console.error("Failed to decode base64:", e);
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmailAddress(from: string): string {
  // Extract email from "Name <email@domain.com>" format
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
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

    // Get authorized emails for this user
    const { data: authorizedEmails, error: emailsError } = await supabase
      .from("emails_autorises")
      .select("email")
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
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
        const senderEmail = extractEmailAddress(from);

        // Verify sender is authorized
        if (!authorizedEmailList.includes(senderEmail)) {
          console.log(`Skipping unauthorized sender: ${senderEmail}`);
          result.skipped++;
          continue;
        }

        // Extract body text
        const body = extractTextFromPayload(msgData.payload);
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
              user_id: userId
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
