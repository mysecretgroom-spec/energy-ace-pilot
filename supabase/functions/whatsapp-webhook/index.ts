import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// App URL for invitation messages
const APP_URL = "https://energy-ace-pilot.lovable.app";

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

    // Parse Twilio webhook data (application/x-www-form-urlencoded)
    const formData = await req.formData();
    const fromNumber = formData.get("From") as string; // whatsapp:+33649070391
    const body = formData.get("Body") as string || "";
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);
    const mediaUrl0 = formData.get("MediaUrl0") as string | null;
    const mediaContentType0 = formData.get("MediaContentType0") as string | null;

    console.log(`Received WhatsApp message from ${fromNumber}: ${body.substring(0, 50)}...`);

    // Determine message type
    let messageType = "text";
    if (numMedia > 0 && mediaContentType0) {
      if (mediaContentType0.startsWith("image/")) {
        messageType = "image";
      } else if (mediaContentType0.startsWith("audio/")) {
        messageType = "audio";
      } else if (mediaContentType0.includes("pdf") || mediaContentType0.includes("document")) {
        messageType = "document";
      }
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
        media_url: mediaUrl0,
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
        media_url: mediaUrl0,
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

    // 4. User has valid access (trial or active) - process the message
    // Create message record
    const { data: messageRecord, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        user_id: user.user_id,
        from_number: fromNumber,
        message_type: messageType,
        raw_content: body,
        media_url: mediaUrl0,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting message:", insertError);
      throw insertError;
    }

    // 5. Call the agent function for AI processing
    try {
      const agentResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          messageId: messageRecord.id,
          userId: user.user_id,
          userName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          fromNumber,
          messageType,
          content: body,
          mediaUrl: mediaUrl0,
          mediaContentType: mediaContentType0,
        }),
      });

      const agentResult = await agentResponse.json();
      console.log("Agent response:", agentResult);

      // Send the response message
      if (agentResult.responseMessage) {
        await sendWhatsAppMessage(
          TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN,
          TWILIO_WHATSAPP_NUMBER,
          fromNumber,
          agentResult.responseMessage
        );

        // Update message with response
        await supabase
          .from("whatsapp_messages")
          .update({
            response_sent: agentResult.responseMessage,
            detected_intent: agentResult.intent,
            detected_entities: agentResult.entities || {},
            action_taken: agentResult.actionTaken,
            entity_id: agentResult.entityId,
            entity_type: agentResult.entityType,
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", messageRecord.id);
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
    }

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
async function sendWhatsAppMessage(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<void> {
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

  // Send each chunk sequentially
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

    console.log(`WhatsApp message sent to ${toNumber}${chunkLabel} (${chunk.length} chars)`);
    
    // Small delay between chunks to ensure order
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}
