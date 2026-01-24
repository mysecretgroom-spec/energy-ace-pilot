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

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find users with past_due status for more than 14 days using RPC
    const { data: delinquentUsers, error: fetchError } = await supabase.rpc("get_delinquent_subscriptions", {
      p_past_due_before: fourteenDaysAgo.toISOString()
    });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${delinquentUsers?.length || 0} delinquent users (>14 days past due)`);

    const blockedUsers: string[] = [];

    for (const user of delinquentUsers || []) {
      // Block the user
      await supabase.rpc("block_saas_user", { p_user_id: user.user_id });

      blockedUsers.push(user.user_id);

      // Sync OneSignal tags
      await fetch(`${supabaseUrl}/functions/v1/saas-sync-onesignal-tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          app_access: "blocked",
          sub_status: "blocked",
        }),
      });

      // Send notification to user about account being blocked
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_id: user.user_id,
          title: "Compte suspendu",
          message: "Votre compte a été suspendu en raison d'un impayé. Veuillez régulariser votre situation.",
        }),
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Blocked ${blockedUsers.length} delinquent users`,
        users: blockedUsers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error checking billing delinquency:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
