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

    // Find users whose trial ends in exactly 2 days (between 2d and 3d from now)
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find users whose trial ends in ~2 days via RPC
    const { data: users, error: usersError } = await supabase.rpc(
      "get_trial_expiring_soon" as any,
      {
        p_from: twoDaysFromNow.toISOString(),
        p_to: threeDaysFromNow.toISOString(),
      }
    );

    if (usersError) {
      console.error("Error fetching expiring trials:", usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users with trial expiring in ~2 days`);

    const notifiedUsers: string[] = [];

    for (const user of users || []) {
      const userId = user.user_id;
      const trialEndsAt = new Date(user.trial_ends_at);
      const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 1) Send push notification via OneSignal
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: "⏰ Votre essai se termine bientôt",
            message: `Plus que ${daysLeft} jours d'essai gratuit ! Abonnez-vous pour garder l'accès à toutes les fonctionnalités.`,
            url: "/abonnement",
            data: { type: "trial_expiring" },
          }),
        });
        console.log(`Push notification sent to ${userId}`);
      } catch (pushErr) {
        console.error(`Push notification failed for ${userId}:`, pushErr);
      }

      // 2) Send WhatsApp notification if user has a phone number
      if (user.phone) {
        try {
          const whatsappMessage = [
            `⏰ *Votre essai DébalePro se termine dans ${daysLeft} jours !*`,
            "",
            "Profitez de toutes les fonctionnalités premium :",
            "✅ Résultats d'études complets",
            "✅ Mode HEJJA",
            "✅ Synchronisation Gmail",
            "✅ Support prioritaire",
            "",
            "👉 Abonnez-vous maintenant pour ne rien perdre !",
          ].join("\n");

          await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              to: user.phone,
              message: whatsappMessage,
            }),
          });
          console.log(`WhatsApp sent to ${userId} (${user.phone})`);
        } catch (waErr) {
          console.error(`WhatsApp failed for ${userId}:`, waErr);
        }
      }

      notifiedUsers.push(userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: notifiedUsers.length,
        users: notifiedUsers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in trial-expiry-reminder:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
