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

    // Find users whose trial has expired using RPC
    const { data: expiredTrials, error: fetchError } = await supabase.rpc("get_expired_trials", { p_now: now });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${expiredTrials?.length || 0} expired trials`);

    const updatedUsers: string[] = [];

    for (const user of expiredTrials || []) {
      // Check if user has active subscription
      const { data: subs } = await supabase.from("subscriptions").select("id")
        .eq("user_id", user.user_id).in("status", ["active", "trialing", "past_due"]).limit(1);

      const hasActiveSubscription = (subs?.length ?? 0) > 0;
      const newAccess = hasActiveSubscription ? "active" : "paywall";

      // Update access state
      await supabase.rpc("update_saas_access_state", {
        p_user_id: user.user_id,
        p_app_access: newAccess
      });

      updatedUsers.push(user.user_id);

      // Sync OneSignal tags
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
