import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncTagsPayload {
  user_id: string;
  app_access?: string;
  sub_status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SyncTagsPayload = await req.json();
    const { user_id, app_access, sub_status } = payload;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tags: Record<string, string> = {};
    if (app_access) tags.app_access = app_access;
    if (sub_status) tags.sub_status = sub_status;

    if (Object.keys(tags).length === 0) {
      return new Response(
        JSON.stringify({ error: "No tags to sync" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing OneSignal tags for user ${user_id}:`, tags);

    // Update tags via OneSignal API
    const response = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}/users/by/external_id/${user_id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          tags,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("OneSignal API error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to sync tags", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tags synced successfully for user:", user_id);

    return new Response(
      JSON.stringify({ success: true, tags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error syncing OneSignal tags:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
