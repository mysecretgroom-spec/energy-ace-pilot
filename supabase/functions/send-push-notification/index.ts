import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationPayload {
  user_id: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: PushNotificationPayload = await req.json();
    const { user_id, title, message, url, data } = payload;

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to user ${user_id}: ${title}`);

    // Send notification via OneSignal
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        // Target specific user by external_user_id (set when user logs in)
        include_aliases: {
          external_id: [user_id]
        },
        target_channel: "push",
        headings: { en: title, fr: title },
        contents: { en: message, fr: message },
        url: url || undefined,
        data: data || {},
        // Chrome-specific options
        chrome_web_icon: "/pwa-icons/icon-192x192.png",
        chrome_web_badge: "/pwa-icons/icon-72x72.png",
        // iOS options
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
        // Android options  
        android_accent_color: "FF22C55E",
        android_led_color: "FF22C55E",
        // TTL for offline users (24 hours)
        ttl: 86400,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("OneSignal API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send notification", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Notification sent successfully:", result.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: result.id,
        recipients: result.recipients 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
