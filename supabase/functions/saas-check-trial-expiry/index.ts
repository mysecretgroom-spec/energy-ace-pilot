import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find users whose trial has expired but are still in 'trial' status
    const { data: expiredTrials, error: fetchError } = await supabase
      .from("access_state")
      .select("user_id, trial_ends_at")
      .eq("app_access", "trial")
      .lt("trial_ends_at", now)
      .schema("saas");

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${expiredTrials?.length || 0} expired trials`);

    const updatedUsers: string[] = [];

    for (const user of expiredTrials || []) {
      // Check if user has active subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.user_id)
        .schema("saas")
        .single();

      if (subscription?.status === "active") {
        // User has active subscription, update to active
        await supabase
          .from("access_state")
          .update({ app_access: "active" })
          .eq("user_id", user.user_id)
          .schema("saas");
      } else {
        // No active subscription, show paywall
        await supabase
          .from("access_state")
          .update({ app_access: "paywall" })
          .eq("user_id", user.user_id)
          .schema("saas");
      }

      updatedUsers.push(user.user_id);

      // Sync OneSignal tags
      const newAccess = subscription?.status === "active" ? "active" : "paywall";
      await fetch(`${supabaseUrl}/functions/v1/saas-sync-onesignal-tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          app_access: newAccess,
        }),
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedUsers.length} users`,
        users: updatedUsers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error checking trial expiry:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
