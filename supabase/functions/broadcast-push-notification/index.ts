import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title || "Mise à jour disponible";
    const message =
      body.message ||
      "Veuillez recharger l'application pour appliquer la dernière mise à jour.";
    const url = body.url || "/";

    console.log(`Broadcasting push to all subscribed users: ${title}`);

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Subscribed Users"],
        target_channel: "push",
        headings: { en: title, fr: title },
        contents: { en: message, fr: message },
        url,
        data: { force_reload: true, ...(body.data || {}) },
        chrome_web_icon: "/pwa-icons/icon-192x192.png",
        chrome_web_badge: "/pwa-icons/icon-72x72.png",
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
        android_accent_color: "FF22C55E",
        ttl: 86400,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OneSignal API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to broadcast", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Broadcast sent:", result.id, "recipients:", result.recipients);
    return new Response(
      JSON.stringify({ success: true, notification_id: result.id, recipients: result.recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error broadcasting push:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
