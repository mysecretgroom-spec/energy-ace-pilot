import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { badRequest, httpUrl, mimeType } from "../_shared/zodHttp.ts";
import { verifyTwilioSignature, reconstructPublicUrl } from "../_shared/twilioSignature.ts";

// Twilio signature validation modes:
//   - "on"    → strict (reject on invalid signature)
//   - "warn"  → log warning but accept (default — safe rollout)
//   - "off"   → skip entirely
// Default is "warn" because URL reconstruction behind Supabase's edge proxy
// can drift from the exact URL Twilio signed, which would block all messages.
const SIGNATURE_MODE = (Deno.env.get("TWILIO_SIGNATURE_VALIDATION") ?? "warn").toLowerCase();
const SIGNATURE_VALIDATION_OFF = SIGNATURE_MODE !== "on";

// =============================================================
// Twilio WhatsApp webhook payload schema (form-urlencoded).
// All values arrive as strings; we coerce numbers, cap lengths,
// and pin URLs to api.twilio.com to defend against SSRF via spoofed media.
// =============================================================
const TWILIO_MEDIA_URL_RE = /^https:\/\/(api|media)\.twilio\.com\//;
const twilioMediaUrl = httpUrl.refine((u) => TWILIO_MEDIA_URL_RE.test(u), {
  message: "Media URL must originate from api.twilio.com",
});

const TwilioWebhookSchema = z.object({
  From: z.string().min(1).max(128).regex(/^whatsapp:\+?[0-9]+$/, "Invalid From"),
  To: z.string().max(128).optional(),
  Body: z.string().max(8000).default(""),
  NumMedia: z.string().regex(/^\d+$/, "NumMedia must be a digit string").default("0"),
  MessageSid: z.string().max(128).optional(),
  ProfileName: z.string().max(256).optional(),
  WaId: z.string().max(64).optional(),
  OriginalRepliedMessageSid: z.string().max(128).optional(),
  OriginalRepliedMessageBody: z.string().max(8000).optional(),
}).passthrough(); // MediaUrl0..N and MediaContentType0..N are dynamic — validated below

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// App URL for invitation messages
const APP_URL = "https://energy-ace-pilot.lovable.app";

// Maximum number of media files to process per message
const MAX_MEDIA_COUNT = 10;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    // Check if Twilio is configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook data (application/x-www-form-urlencoded) + validate
    // We must read the raw text first to verify Twilio's HMAC signature, then
    // re-parse via URLSearchParams (req.formData() would consume the body).
    const rawBody = await req.text();
    const rawForm: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { rawForm[k] = v; });

    // Twilio signature verification (X-Twilio-Signature). Without this, the
    // endpoint is a public webhook anyone can spam to impersonate users.
    const sigHeader = req.headers.get("x-twilio-signature");
    const publicUrl = reconstructPublicUrl(req);
    const sigOk = await verifyTwilioSignature(TWILIO_AUTH_TOKEN, publicUrl, rawForm, sigHeader);
    if (!sigOk && SIGNATURE_MODE === "on") {
      console.warn("[whatsapp-webhook] Rejected request: invalid X-Twilio-Signature");
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }
    if (!sigOk && SIGNATURE_MODE === "warn") {
      console.warn("[whatsapp-webhook] X-Twilio-Signature mismatch (warn-only mode, request accepted)");
    }

    const parsed = TwilioWebhookSchema.safeParse(rawForm);
    if (!parsed.success) {
      console.warn("[whatsapp-webhook] Invalid Twilio payload:", JSON.stringify(parsed.error.flatten().fieldErrors));
      return badRequest("Invalid Twilio payload", parsed.error.flatten().fieldErrors, corsHeaders);
    }
    const data = parsed.data;
    const fromNumber = data.From;
    const body = data.Body;
    const numMedia = parseInt(data.NumMedia, 10);
    const messageSid = data.MessageSid ?? null;
    const originalMessageContext = data.OriginalRepliedMessageSid ?? null;
    const quotedBody = data.OriginalRepliedMessageBody ?? null;

    // Collect all media URLs and types (up to MAX_MEDIA_COUNT) — validate each
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];
    const actualMediaCount = Math.min(Math.max(0, numMedia), MAX_MEDIA_COUNT);

    for (let i = 0; i < actualMediaCount; i++) {
      const rawUrl = rawForm[`MediaUrl${i}`];
      const rawType = rawForm[`MediaContentType${i}`];
      if (!rawUrl) continue;
      const urlOk = twilioMediaUrl.safeParse(rawUrl);
      const typeOk = rawType ? mimeType.safeParse(rawType) : { success: true, data: "application/octet-stream" as string };
      if (!urlOk.success) {
        console.warn(`[whatsapp-webhook] Rejected media #${i}: invalid URL`);
        continue;
      }
      mediaUrls.push(urlOk.data);
      mediaTypes.push(typeOk.success ? (typeOk.data as string) : "application/octet-stream");
    }

    console.log(`Received WhatsApp from ${fromNumber}: "${body.substring(0, 50)}..." with ${mediaUrls.length} media(s)`);
    if (originalMessageContext) {
      console.log(`Reply to message SID: ${originalMessageContext}`);
    }

    // Determine message type
    let messageType = "text";
    if (mediaUrls.length > 0) {
      const firstType = mediaTypes[0] || "";
      if (firstType.startsWith("image/")) {
        messageType = mediaUrls.length > 1 ? "multi_image" : "image";
      } else if (firstType.startsWith("audio/")) {
        messageType = "audio";
      } else if (firstType.includes("pdf") || firstType.includes("document")) {
        messageType = mediaUrls.length > 1 ? "multi_document" : "document";
      } else {
        messageType = mediaUrls.length > 1 ? "multi_media" : "media";
      }
    }

    // 0. Ignore Twilio retries of a message already received
    if (messageSid) {
      const { data: dup } = await supabase.from("whatsapp_messages").select("id").eq("twilio_message_sid", messageSid).limit(1).maybeSingle();
      if (dup) return new Response(JSON.stringify({ status: "duplicate" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Find user by phone number
    const { data: users, error: userError } = await supabase.rpc("find_user_by_phone", {
      p_phone: fromNumber,
    });

    if (userError) {
      console.error("Error finding user:", userError);
      throw userError;
    }

    // 2. Handle user not found
    if (!users || users.length === 0) {
      console.log(`User not found for phone: ${fromNumber}`);
      
      // Log the rejected message
      await supabase.from("whatsapp_messages").insert({
        from_number: fromNumber,
        message_type: messageType,
        raw_content: body,
        media_url: mediaUrls[0] || null,
        media_urls: mediaUrls,
        media_types: mediaTypes,
        twilio_message_sid: messageSid,
        status: "rejected",
        rejection_reason: "not_registered",
      });

      // Send invitation message
      const inviteMessage = 
        `👋 Bonjour ! Je suis l'assistant DébalePro.\n\n` +
        `Pour utiliser ce service, inscrivez-vous sur notre application :\n` +
        `👉 ${APP_URL}\n\n` +
        `Profitez de 15 jours d'essai gratuit !`;

      await sendWhatsAppMessage(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_NUMBER,
        fromNumber,
        inviteMessage
      );

      return new Response(
        JSON.stringify({ status: "rejected", reason: "not_registered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = users[0];
    console.log(`Found user: ${user.first_name} ${user.last_name} (${user.app_access})`);

    // 3. Check SaaS access
    if (user.app_access === "paywall" || user.app_access === "blocked") {
      console.log(`User ${user.user_id} has invalid access: ${user.app_access}`);

      // Log the rejected message
      await supabase.from("whatsapp_messages").insert({
        user_id: user.user_id,
        from_number: fromNumber,
        message_type: messageType,
        raw_content: body,
        media_url: mediaUrls[0] || null,
        media_urls: mediaUrls,
        media_types: mediaTypes,
        twilio_message_sid: messageSid,
        status: "rejected",
        rejection_reason: user.app_access === "blocked" ? "access_blocked" : "trial_expired",
      });

      // Send appropriate message
      let accessMessage: string;
      if (user.app_access === "blocked") {
        accessMessage = 
          `Bonjour ${user.first_name} 👋\n\n` +
          `Votre accès est actuellement suspendu suite à un problème de paiement.\n\n` +
          `Merci de régulariser votre situation sur :\n` +
          `👉 ${APP_URL}/abonnement\n\n` +
          `Notre équipe reste à votre disposition.`;
      } else {
        accessMessage = 
          `Bonjour ${user.first_name} 👋\n\n` +
          `Votre période d'essai de 15 jours est terminée.\n\n` +
          `Pour continuer à utiliser l'assistant WhatsApp et toutes les fonctionnalités de DébalePro, abonnez-vous :\n` +
          `👉 ${APP_URL}/abonnement\n\n` +
          `Des questions ? Contactez notre support !`;
      }

      await sendWhatsAppMessage(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_NUMBER,
        fromNumber,
        accessMessage
      );

      return new Response(
        JSON.stringify({ status: "rejected", reason: user.app_access }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Find the original message if this is a reply
    let replyToMessageId: string | null = null;
    let replyToMessageContent: string | null = null;
    
    if (originalMessageContext) {
      // Look up the original message by Twilio SID
      const { data: originalMessage } = await supabase
        .from("whatsapp_messages")
        .select("id, response_sent, detected_intent")
        .eq("twilio_message_sid", originalMessageContext)
        .eq("user_id", user.user_id)
        .maybeSingle();
      
      if (originalMessage) {
        replyToMessageId = originalMessage.id;
        replyToMessageContent = originalMessage.response_sent || quotedBody;
        console.log(`Found reply-to message: ${replyToMessageId} (intent: ${originalMessage.detected_intent})`);
      } else if (quotedBody) {
        // Fallback: try to find by content match if SID not found
        // This helps with quoted text that Twilio provides
        replyToMessageContent = quotedBody;
        console.log(`Original message SID not found, using quoted body: "${quotedBody.substring(0, 50)}..."`);
      }
    }

    // 5. User has valid access (trial or active) - process the message
    // Create message record
    const { data: messageRecord, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id: user.user_id,
        from_number: fromNumber,
        message_type: messageType,
        raw_content: body,
        media_url: mediaUrls[0] || null,
        media_urls: mediaUrls,
        media_types: mediaTypes,
        twilio_message_sid: messageSid,
        reply_to_message_id: replyToMessageId,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting message:", insertError);
      throw insertError;
    }

    // 6. Traitement en arrière-plan, un message à la fois par utilisateur (ordre d'arrivée),
    // pour que des messages consécutifs ne se télescopent pas (état de conversation partagé).
    const work = (async () => {
    await waitForPreviousMessages(supabase, user.user_id, messageRecord.id, messageRecord.created_at);
    // 6. Call the agent function for AI processing
    try {
      const agentPayload: Record<string, unknown> = {
        messageId: messageRecord.id,
        userId: user.user_id,
        userName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        fromNumber,
        messageType,
        content: body,
        // Multi-media support
        mediaUrls: mediaUrls,
        mediaContentTypes: mediaTypes,
        // Reply context
        isReplyToMessage: !!replyToMessageId || !!replyToMessageContent,
        replyToMessageId: replyToMessageId,
        replyToMessageContent: replyToMessageContent,
        // Twilio quoted-reply SID (for post-action edits)
        repliedToTwilioSid: originalMessageContext,
      };

      // Optional fields must be omitted when absent: the agent validator
      // intentionally rejects null media URLs, and confirmation-only texts
      // ("Oui") used to be dropped because of `mediaUrl: null`.
      if (mediaUrls[0]) agentPayload.mediaUrl = mediaUrls[0];
      if (mediaTypes[0]) agentPayload.mediaContentType = mediaTypes[0];

      const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(agentPayload),
      });

      if (!agentResponse.ok) {
        const errorBody = await agentResponse.text().catch(() => "");
        throw new Error(`Agent returned HTTP ${agentResponse.status}: ${errorBody.slice(0, 500)}`);
      }

      const agentResult = await agentResponse.json();
      console.log("Agent response:", agentResult);

      // Send the response message if available and capture ALL chunk SIDs
      let responseTwilioSids: string[] = [];
      if (agentResult.responseMessage) {
        responseTwilioSids = await sendWhatsAppMessage(
          TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN,
          TWILIO_WHATSAPP_NUMBER,
          fromNumber,
          agentResult.responseMessage
        );
      }
      // Last SID is the "primary" one (kept for backward compat with last_action_message_sid)
      const responseTwilioSid: string | null =
        responseTwilioSids.length > 0 ? responseTwilioSids[responseTwilioSids.length - 1] : null;

      // ALWAYS update message status to processed (whether or not there's a response)
      await supabase
        .from("whatsapp_messages")
        .update({
          response_sent: agentResult.responseMessage || null,
          detected_intent: agentResult.intent,
          detected_entities: agentResult.entities || {},
          action_taken: agentResult.actionTaken,
          entity_id: agentResult.entityId,
          entity_type: agentResult.entityType,
          status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", messageRecord.id);

      // If we got a response SID, create a record for the bot's response
      // (so it can be referenced if user replies to it)
      if (responseTwilioSid && agentResult.responseMessage) {
        await supabase.from("whatsapp_messages").insert({
          user_id: user.user_id,
          from_number: TWILIO_WHATSAPP_NUMBER,
          message_type: "text",
          raw_content: agentResult.responseMessage,
          twilio_message_sid: responseTwilioSid,
          reply_to_message_id: messageRecord.id,
          detected_intent: agentResult.intent,
          status: "sent",
          processed_at: new Date().toISOString(),
        });

        // If the agent flagged this as an action recap, store the SID on
        // the conversation so the user can reply to it to edit the action.
        if (agentResult.lastActionToRemember) {
          await supabase
            .from("whatsapp_conversations")
            .update({
              last_action_message_sid: responseTwilioSid,
              last_executed_action: agentResult.lastActionToRemember,
            })
            .eq("user_id", user.user_id);
        }

        // If the agent created a pending workflow that expects an answer,
        // map the response SID -> workflow snapshot so a quoted-reply to
        // THIS exact message can be routed back to the right question.
        if (agentResult.pendingActionToTrack) {
          const { data: convRow } = await supabase
            .from("whatsapp_conversations")
            .select("pending_message_sids")
            .eq("user_id", user.user_id)
            .maybeSingle();

          const existing = (convRow?.pending_message_sids || {}) as Record<
            string,
            { snapshot: unknown; createdAt: string }
          >;

          // Prune entries older than 24h before adding the new ones
          const TTL = 24 * 60 * 60 * 1000;
          const now = Date.now();
          const pruned: typeof existing = {};
          for (const [sid, entry] of Object.entries(existing)) {
            const ts = entry?.createdAt ? Date.parse(entry.createdAt) : 0;
            if (ts && now - ts < TTL) pruned[sid] = entry;
          }

          // Map EVERY chunk SID to the same pending action snapshot.
          // This way, if Twilio split the message into multiple parts,
          // a quoted-reply to ANY chunk routes to the same workflow.
          const createdAt = new Date().toISOString();
          for (const sid of responseTwilioSids) {
            pruned[sid] = {
              snapshot: agentResult.pendingActionToTrack,
              createdAt,
            };
          }

          await supabase
            .from("whatsapp_conversations")
            .update({ pending_message_sids: pruned })
            .eq("user_id", user.user_id);

          console.log(
            `[reply-routing] Tracked ${responseTwilioSids.length} SID(s) -> workflow ${
              (agentResult.pendingActionToTrack as { workflowState?: string }).workflowState
            }`,
          );
        }
      }

      return new Response(
        JSON.stringify({ status: "processed", result: agentResult }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (agentError) {
      console.error("Agent processing error:", agentError);
      
      // Update message as failed
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "failed",
          error_message: agentError instanceof Error ? agentError.message : "Unknown error",
        })
        .eq("id", messageRecord.id);

      // Send error message to user
      const errorMessage = 
        `Désolé ${user.first_name}, je n'ai pas pu traiter votre message.\n\n` +
        `Veuillez réessayer ou utiliser l'application directement :\n` +
        `👉 ${APP_URL}`;

      await sendWhatsAppMessage(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_WHATSAPP_NUMBER,
        fromNumber,
        errorMessage
      );

      return new Response(
        JSON.stringify({ status: "failed", error: "Agent processing failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    })().catch((e) => console.error("Background processing error:", e));
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return new Response(JSON.stringify({ status: "queued" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to send WhatsApp message via Twilio
// Supports long messages by splitting into chunks (WhatsApp limit ~1600 chars)
// Returns the Twilio message SIDs of ALL sent chunks (in order)
async function sendWhatsAppMessage(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<string[]> {
  const MAX_CHARS = 1500; // Safe limit below WhatsApp's 1600
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  // Split message into chunks if too long
  const chunks: string[] = [];
  if (message.length <= MAX_CHARS) {
    chunks.push(message);
  } else {
    // Split on newlines when possible, or force split
    let remaining = message;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS) {
        chunks.push(remaining);
        break;
      }
      
      // Try to find a good split point (double newline, single newline, or space)
      let splitIndex = remaining.lastIndexOf("\n\n", MAX_CHARS);
      if (splitIndex < MAX_CHARS * 0.5) {
        splitIndex = remaining.lastIndexOf("\n", MAX_CHARS);
      }
      if (splitIndex < MAX_CHARS * 0.5) {
        splitIndex = remaining.lastIndexOf(" ", MAX_CHARS);
      }
      if (splitIndex < MAX_CHARS * 0.3) {
        splitIndex = MAX_CHARS; // Force split
      }
      
      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }
  }

  // Send each chunk sequentially and collect all SIDs
  const sentSids: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkLabel = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: chunk,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twilio send error${chunkLabel}:`, errorText);
      throw new Error(`Failed to send WhatsApp message: ${response.status}`);
    }

    // Parse response to get message SID
    try {
      const responseData = await response.json();
      if (responseData.sid) sentSids.push(responseData.sid);
    } catch {
      // If we can't parse the response, just continue
    }

    console.log(`WhatsApp message sent to ${toNumber}${chunkLabel} (${chunk.length} chars)`);
    
    // Small delay between chunks to ensure order
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return sentSids;
}

/** Waits until earlier messages of the same user have finished (max ~4 min, stale ones ignored). */
async function waitForPreviousMessages(supabase: any, userId: string, messageId: string, createdAt: string) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const { data } = await supabase.from("whatsapp_messages").select("id")
      .eq("user_id", userId).eq("status", "processing").neq("id", messageId)
      .lt("created_at", createdAt)
      .gt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .limit(1);
    if (!data?.length) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
}
