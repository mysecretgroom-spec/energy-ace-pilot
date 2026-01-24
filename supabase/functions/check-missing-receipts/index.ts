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

    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday - 7); // Previous week Monday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Previous week Sunday
    weekEnd.setHours(23, 59, 59, 999);

    console.log(`Checking missing receipts for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Get all unique user IDs who had RDV this week
    const { data: usersWithRdv, error: rdvError } = await supabase
      .from("rdv")
      .select("user_id")
      .gte("date_heure", weekStart.toISOString())
      .lte("date_heure", weekEnd.toISOString());

    if (rdvError) {
      console.error("Error fetching RDV:", rdvError);
      throw rdvError;
    }

    if (!usersWithRdv || usersWithRdv.length === 0) {
      console.log("No users with RDV this week");
      return new Response(
        JSON.stringify({ message: "No users with RDV this week", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithRdv.map(r => r.user_id))];
    console.log(`Found ${uniqueUserIds.length} users with RDV this week`);

    // For each user, check if they uploaded any receipts (frais) this week
    const usersToNotify: string[] = [];

    for (const userId of uniqueUserIds) {
      const { data: receipts, error: receiptsError } = await supabase
        .from("frais")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())
        .limit(1);

      if (receiptsError) {
        console.error(`Error checking receipts for user ${userId}:`, receiptsError);
        continue;
      }

      if (!receipts || receipts.length === 0) {
        usersToNotify.push(userId);
      }
    }

    console.log(`${usersToNotify.length} users need notification`);

    // Send notifications to users who need them
    let notifiedCount = 0;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    for (const userId of usersToNotify) {
      // Create in-app notification
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          titre: "Factures de la semaine",
          message: "Pensez à importer vos factures pour voir vos frais de la semaine.",
          type: "systeme",
          date_envoi: new Date().toISOString(),
        });

      if (notifError) {
        console.error(`Error creating notification for user ${userId}:`, notifError);
      } else {
        notifiedCount++;
      }

      // Send push notification via OneSignal if configured
      if (oneSignalAppId && oneSignalApiKey) {
        try {
          const pushResponse = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${oneSignalApiKey}`,
            },
            body: JSON.stringify({
              app_id: oneSignalAppId,
              include_external_user_ids: [userId],
              contents: { fr: "Pensez à importer vos factures pour voir vos frais de la semaine.", en: "Remember to import your receipts to track your weekly expenses." },
              headings: { fr: "Factures de la semaine", en: "Weekly Receipts" },
              url: "/finance",
            }),
          });

          if (!pushResponse.ok) {
            const pushError = await pushResponse.text();
            console.error(`Push notification error for user ${userId}:`, pushError);
          }
        } catch (pushErr) {
          console.error(`Push notification exception for user ${userId}:`, pushErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Check completed",
        usersWithRdv: uniqueUserIds.length,
        usersNotified: notifiedCount,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});