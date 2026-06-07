import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { validateJson, httpUrl } from "../_shared/zodHttp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pin outbound media to Twilio CDN to defend against SSRF via attacker-supplied URLs.
const TWILIO_MEDIA_RE = /^https:\/\/(api|media)\.twilio\.com\//;
const twilioMediaUrl = httpUrl.refine((u) => TWILIO_MEDIA_RE.test(u), {
  message: "mediaUrl must be hosted on api.twilio.com",
});

// "to" must be E.164 (optionally prefixed with whatsapp:). Blocks header injection.
const phoneE164 = z.string().regex(/^(whatsapp:)?\+?[1-9]\d{6,18}$/, "Invalid phone");

const SendMessageSchema = z.object({
  to: phoneE164,
  message: z.string().min(1).max(4096),
  mediaUrl: twilioMediaUrl.optional(),
}).strict();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const v = await validateJson(req, SendMessageSchema, corsHeaders, { allowEmpty: false });
    if (!v.ok) return v.response;
    const { to, message, mediaUrl } = v.data;

    // Ensure the 'to' number has whatsapp: prefix
    const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    // Build request body
    const bodyParams: Record<string, string> = {
      From: TWILIO_WHATSAPP_NUMBER,
      To: toNumber,
      Body: message,
    };

    if (mediaUrl) {
      bodyParams.MediaUrl = mediaUrl;
    }

    // Send via Twilio API
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", responseData);
      return new Response(
        JSON.stringify({ error: "Failed to send message", details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Message sent successfully to ${toNumber}, SID: ${responseData.sid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: responseData.sid,
        status: responseData.status 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Send error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
