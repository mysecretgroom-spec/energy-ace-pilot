import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getValidAccessToken } from "../_shared/google-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS for manual triggers
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting scheduled Gmail sync for all eligible users...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with:
    // 1. Gmail sync enabled
    // 2. Valid Google tokens
    // 3. Last sync was more than their interval ago (or never synced)
    const { data: eligibleUsers, error: usersError } = await supabase
      .from("user_settings")
      .select(`
        user_id,
        gmail_sync_interval_minutes,
        gmail_last_auto_sync
      `)
      .eq("gmail_sync_enabled", true);

    if (usersError) {
      console.error("Error fetching user settings:", usersError);
      throw usersError;
    }

    if (!eligibleUsers?.length) {
      console.log("No users with Gmail sync enabled");
      return new Response(
        JSON.stringify({ message: "No users to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${eligibleUsers.length} users with sync enabled`);

    const results: Array<{
      userId: string;
      status: "synced" | "skipped" | "error";
      imported?: number;
      error?: string;
    }> = [];

    const now = new Date();

    for (const userSettings of eligibleUsers) {
      const { user_id, gmail_sync_interval_minutes, gmail_last_auto_sync } = userSettings;

      // Check if enough time has passed since last sync
      if (gmail_last_auto_sync) {
        const lastSync = new Date(gmail_last_auto_sync);
        const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
        
        if (minutesSinceLastSync < gmail_sync_interval_minutes) {
          console.log(`Skipping user ${user_id}: last sync was ${minutesSinceLastSync.toFixed(1)} minutes ago (interval: ${gmail_sync_interval_minutes})`);
          results.push({ userId: user_id, status: "skipped" });
          continue;
        }
      }

      // Check if user has valid Google tokens
      const accessToken = await getValidAccessToken(user_id);
      if (!accessToken) {
        console.log(`Skipping user ${user_id}: no valid Google token`);
        results.push({ userId: user_id, status: "skipped" });
        continue;
      }

      // Check if user has authorized emails
      const { data: authorizedEmails } = await supabase
        .from("emails_autorises")
        .select("id")
        .eq("user_id", user_id)
        .eq("actif", true)
        .limit(1);

      if (!authorizedEmails?.length) {
        console.log(`Skipping user ${user_id}: no authorized emails`);
        results.push({ userId: user_id, status: "skipped" });
        continue;
      }

      try {
        console.log(`Syncing Gmail for user ${user_id}...`);

        // Call the sync function directly internally
        const syncResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/sync-gmail-rdv`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "x-user-id": user_id // Pass user ID for service role calls
            }
          }
        );

        const syncResult = await syncResponse.json();

        if (!syncResponse.ok) {
          console.error(`Sync failed for user ${user_id}:`, syncResult.error);
          results.push({ 
            userId: user_id, 
            status: "error", 
            error: syncResult.error 
          });
          continue;
        }

        // Update last sync time
        await supabase
          .from("user_settings")
          .update({ gmail_last_auto_sync: now.toISOString() })
          .eq("user_id", user_id);

        const totalImportedForUser = (syncResult.imported || 0) + (syncResult.updated || 0);

        // Create notification and send push if RDVs were imported
        if (totalImportedForUser > 0) {
          const message = totalImportedForUser === 1
            ? "1 nouveau RDV a été importé depuis Gmail"
            : `${totalImportedForUser} nouveaux RDV ont été importés depuis Gmail`;

          // Save in-app notification
          await supabase
            .from("notifications")
            .insert({
              user_id,
              type: "nouveau_rdv",
              titre: "📧 Import Gmail automatique",
              message,
              lue: false,
              date_envoi: now.toISOString()
            });

          // Send push notification via OneSignal
          try {
            await fetch(
              `${SUPABASE_URL}/functions/v1/send-push-notification`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  user_id,
                  title: "📧 Import Gmail automatique",
                  message,
                  url: "/planning",
                  data: { type: "gmail_import", count: totalImportedForUser }
                })
              }
            );
            console.log(`Push notification sent to user ${user_id}`);
          } catch (pushError) {
            console.error(`Failed to send push to user ${user_id}:`, pushError);
          }
        }

        results.push({
          userId: user_id,
          status: "synced",
          imported: totalImportedForUser
        });

        console.log(`Synced user ${user_id}: ${syncResult.imported || 0} imported, ${syncResult.updated || 0} updated`);

      } catch (error) {
        console.error(`Error syncing user ${user_id}:`, error);
        results.push({
          userId: user_id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const syncedCount = results.filter(r => r.status === "synced").length;
    const totalImported = results.reduce((sum, r) => sum + (r.imported || 0), 0);

    console.log(`Scheduled sync complete: ${syncedCount} users synced, ${totalImported} total imported`);

    return new Response(
      JSON.stringify({
        message: "Scheduled sync complete",
        synced: syncedCount,
        totalImported,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
