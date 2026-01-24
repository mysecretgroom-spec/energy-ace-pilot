import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationPayload {
  audienceType: "all" | "status" | "user" | "segment";
  statusFilter?: "trial" | "active" | "paywall" | "blocked";
  targetUserId?: string;
  segmentName?: string;
  title: string;
  message: string;
  deepLink?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .schema("saas")
      .single();

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: SendNotificationPayload = await req.json();
    const { audienceType, statusFilter, targetUserId, segmentName, title, message, deepLink, data } = payload;

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let oneSignalBody: Record<string, any> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: title, fr: title },
      contents: { en: message, fr: message },
      url: deepLink || undefined,
      data: data || {},
      chrome_web_icon: "/pwa-icons/icon-192x192.png",
      chrome_web_badge: "/pwa-icons/icon-72x72.png",
      android_accent_color: "FF22C55E",
      ttl: 86400,
    };

    let audienceDescription = "";

    // Build targeting based on audienceType
    switch (audienceType) {
      case "all":
        oneSignalBody.included_segments = ["Subscribed Users"];
        audienceDescription = "all";
        break;

      case "status":
        if (!statusFilter) {
          return new Response(
            JSON.stringify({ error: "statusFilter required for audienceType 'status'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Target users with specific app_access tag
        oneSignalBody.filters = [
          { field: "tag", key: "app_access", relation: "=", value: statusFilter }
        ];
        audienceDescription = `status:${statusFilter}`;
        break;

      case "user":
        if (!targetUserId) {
          return new Response(
            JSON.stringify({ error: "targetUserId required for audienceType 'user'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        oneSignalBody.include_aliases = { external_id: [targetUserId] };
        oneSignalBody.target_channel = "push";
        audienceDescription = `user:${targetUserId}`;
        break;

      case "segment":
        if (!segmentName) {
          return new Response(
            JSON.stringify({ error: "segmentName required for audienceType 'segment'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        oneSignalBody.included_segments = [segmentName];
        audienceDescription = `segment:${segmentName}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid audienceType" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Admin ${user.id} sending notification to ${audienceDescription}: ${title}`);

    // Log the notification attempt
    const { data: logEntry, error: logError } = await supabase
      .from("notification_log")
      .insert({
        sent_by: user.id,
        audience: audienceDescription,
        title,
        message,
        status: "queued",
      })
      .schema("saas")
      .select()
      .single();

    // Send notification via OneSignal
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(oneSignalBody),
    });

    const result = await response.json();

    // Update log with result
    if (logEntry) {
      await supabase
        .from("notification_log")
        .update({
          onesignal_response: result,
          status: response.ok ? "sent" : "failed",
        })
        .eq("id", logEntry.id)
        .schema("saas");
    }

    if (!response.ok) {
      console.error("OneSignal API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send notification", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin notification sent successfully:", result.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: result.id,
        recipients: result.recipients,
        audience: audienceDescription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending admin notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
