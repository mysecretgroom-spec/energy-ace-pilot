import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getValidAccessToken } from "../_shared/google-auth.ts";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Send a WhatsApp message to the user summarizing imported RDVs
 * and indicating where they start their day (first RDV address).
 */
async function sendWhatsAppRdvSummary(
  supabase: any,
  userId: string,
  totalImported: number,
  syncResult: any
) {
  // 1. Get user's phone number from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, first_name")
    .eq("user_id", userId)
    .single();

  if (!profile?.phone) {
    console.log(`No phone for user ${userId}, skipping WhatsApp`);
    return;
  }

  // 2. Get today's upcoming RDVs for this user (ordered chronologically)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todayRdvs } = await supabase
    .from("rdv")
    .select(`
      id, date_heure, adresse, commentaire,
      clients!inner(nom, prenom, ville, code_postal, adresse)
    `)
    .eq("user_id", userId)
    .gte("date_heure", todayStart.toISOString())
    .lte("date_heure", todayEnd.toISOString())
    .not("status", "in", '("annule","reporte")')
    .order("date_heure", { ascending: true });

  // 3. Build the WhatsApp message
  const greeting = profile.first_name ? `Bonjour ${profile.first_name} 👋` : "Bonjour 👋";
  
  const rdvLabel = totalImported === 1 ? "nouveau RDV importé" : "nouveaux RDV importés";
  let whatsappMessage = `${greeting}\n\n📧 *${totalImported} ${rdvLabel}* depuis Gmail.\n`;

  // Show imported RDV details from sync result (max 5)
  const importedDetails = syncResult.details?.filter(
    (d: any) => d.status === "imported" || d.status === "updated"
  ) || [];

  if (importedDetails.length > 0) {
    whatsappMessage += "\n";
    for (const detail of importedDetails.slice(0, 5)) {
      const label = detail.status === "updated" ? "🔄" : "✅";
      whatsappMessage += `${label} ${detail.subject?.substring(0, 60) || "RDV"}\n`;
    }
    if (importedDetails.length > 5) {
      whatsappMessage += `...et ${importedDetails.length - 5} autre(s)\n`;
    }
  }

  // Show today's planning summary
  if (todayRdvs && todayRdvs.length > 0) {
    whatsappMessage += `\n📍 *Planning du jour (${todayRdvs.length} RDV)* :\n`;
    
    for (const rdv of todayRdvs.slice(0, 5)) {
      const heure = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris"
      });
      const clientName = rdv.clients?.nom || "Client";
      const clientPrenom = rdv.clients?.prenom || "";
      const ville = rdv.clients?.ville || "";
      
      whatsappMessage += `• *${heure}* — ${clientPrenom} ${clientName}`;
      if (ville) whatsappMessage += ` (${ville})`;
      whatsappMessage += "\n";
    }

    // First RDV address for navigation
    const firstRdv = todayRdvs[0];
    const firstAddress = firstRdv.adresse || firstRdv.clients?.adresse;
    const firstCity = firstRdv.clients?.ville;
    const firstPostal = firstRdv.clients?.code_postal;
    
    if (firstAddress) {
      const fullAddress = [firstAddress, firstPostal, firstCity].filter(Boolean).join(" ");
      whatsappMessage += `\n🚗 *Vous commencez à :*\n${fullAddress}\n`;
      whatsappMessage += `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    }
  }

  // 4. Normalize phone to WhatsApp format
  let phone = profile.phone.replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "33" + phone.slice(1);
  if (!phone.startsWith("+")) phone = "+" + phone;
  const whatsappTo = `whatsapp:${phone}`;

  // 5. Send via whatsapp-send edge function
  const sendResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/whatsapp-send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: whatsappTo,
        message: whatsappMessage,
      }),
    }
  );

  if (!sendResponse.ok) {
    const err = await sendResponse.text();
    console.error(`WhatsApp send failed for user ${userId}:`, err);
  } else {
    console.log(`WhatsApp RDV summary sent to user ${userId} (${whatsappTo})`);
  }
}

serve(async (req) => {
  // Handle CORS for manual triggers
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauthorized = requireCronAuth(req, { corsHeaders });
  if (unauthorized) return unauthorized;

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

          // WhatsApp summary is now sent as part of the daily briefing at 6:00 AM
          // No standalone WhatsApp notification here anymore
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
