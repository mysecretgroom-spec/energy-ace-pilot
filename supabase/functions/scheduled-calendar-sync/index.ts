import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, getValidAccessToken } from "../_shared/google-auth.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string; displayName?: string }[];
}

// Extract phone number from text
function extractPhone(text: string): string | null {
  const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
  const match = text.match(phoneRegex);
  return match ? match[0].replace(/[\s.-]/g, '') : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting scheduled Google Calendar sync for all users...");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all users with Google tokens
    const { data: tokens, error: tokensError } = await supabase
      .from("google_tokens")
      .select("user_id");

    if (tokensError) {
      console.error("Error fetching tokens:", tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log("No users with Google tokens found");
      return new Response(
        JSON.stringify({ success: true, message: "No users to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tokens.length} users with Google tokens`);

    let totalSynced = 0;
    let totalErrors = 0;

    for (const token of tokens) {
      const userId = token.user_id;
      console.log(`Syncing user: ${userId}`);

      try {
        const accessToken = await getValidAccessToken(userId);
        if (!accessToken) {
          console.log(`No valid access token for user ${userId}`);
          continue;
        }

        // History is written only on change or error (not every 15 min per user)
        const startedAt = new Date().toISOString();

        // Get date range (7 days before to 30 days ahead)
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 7);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 30);

        // Fetch events from Google Calendar
        const params = new URLSearchParams({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          maxResults: "100",
          singleEvents: "true",
          orderBy: "startTime",
        });

        const calendarResponse = await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!calendarResponse.ok) {
          console.error(`Calendar API error for user ${userId}:`, await calendarResponse.text());
          await supabase.from("google_sync_history").insert({
            user_id: userId,
            sync_type: "import",
            status: "error",
            started_at: startedAt,
            completed_at: new Date().toISOString(),
            error_message: "Failed to fetch calendar events",
          });
          totalErrors++;
          continue;
        }

        const calendarData = await calendarResponse.json();
        const events: CalendarEvent[] = calendarData.items || [];

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const event of events) {
          try {
            // Skip all-day events
            if (!event.start.dateTime) {
              skipped++;
              continue;
            }

            const startDate = new Date(event.start.dateTime);
            const endDate = new Date(event.end.dateTime || event.start.dateTime);
            const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

            // Check if RDV already exists
            const { data: existingRdv } = await supabase
              .from("rdv")
              .select("id")
              .eq("user_id", userId)
              .eq("google_event_id", event.id)
              .maybeSingle();

            if (existingRdv) {
              // Update existing RDV
              await supabase
                .from("rdv")
                .update({
                  date_heure: startDate.toISOString(),
                  duree_minutes: durationMinutes > 0 ? durationMinutes : 60,
                })
                .eq("id", existingRdv.id);
              updated++;
              continue;
            }

            // Extract client info
            let clientName = event.summary || "Client inconnu";
            let clientEmail: string | undefined;
            let clientPhone: string | undefined;

            if (event.attendees && event.attendees.length > 0) {
              const firstAttendee = event.attendees[0];
              if (firstAttendee.displayName) {
                clientName = firstAttendee.displayName;
              }
              clientEmail = firstAttendee.email;
            }

            if (event.description) {
              const phone = extractPhone(event.description);
              if (phone) clientPhone = phone;
            }

            // Detect project type
            let typeProjet = "autre";
            const fullText = `${event.summary || ""} ${event.description || ""}`.toLowerCase();
            if (fullText.includes("photovoltaique") || fullText.includes("solaire") || fullText.includes("panneau")) {
              typeProjet = "photovoltaique";
            } else if (fullText.includes("pompe") || fullText.includes("pac") || fullText.includes("chaleur")) {
              typeProjet = "pompe_a_chaleur";
            } else if (fullText.includes("isolation") || fullText.includes("combles")) {
              typeProjet = "isolation";
            } else if (fullText.includes("chauffe-eau") || fullText.includes("ballon")) {
              typeProjet = "chauffe_eau";
            }

            // Find or create client
            let clientId: string | null = null;

            if (clientEmail) {
              const { data: existingClient } = await supabase
                .from("clients")
                .select("id")
                .eq("user_id", userId)
                .eq("email", clientEmail)
                .maybeSingle();
              if (existingClient) clientId = existingClient.id;
            }

            if (!clientId && clientPhone) {
              const { data: existingClient } = await supabase
                .from("clients")
                .select("id")
                .eq("user_id", userId)
                .eq("telephone", clientPhone)
                .maybeSingle();
              if (existingClient) clientId = existingClient.id;
            }

            if (!clientId) {
              const nameParts = clientName.split(" ");
              const prenom = nameParts[0] || "";
              const nom = nameParts.slice(1).join(" ") || clientName;

              const { data: newClient, error: clientError } = await supabase
                .from("clients")
                .insert({
                  user_id: userId,
                  nom,
                  prenom,
                  email: clientEmail,
                  telephone: clientPhone,
                  adresse: event.location,
                  source: "google_calendar",
                })
                .select("id")
                .single();

              if (clientError) {
                console.error("Error creating client:", clientError);
                continue;
              }
              clientId = newClient.id;
            }

            // Create RDV
            const { error: rdvError } = await supabase
              .from("rdv")
              .insert({
                user_id: userId,
                client_id: clientId,
                date_heure: startDate.toISOString(),
                duree_minutes: durationMinutes > 0 ? durationMinutes : 60,
                type_projet: typeProjet,
                status: "nouveau",
                commentaire: event.description,
                google_event_id: event.id,
                source: "google_calendar",
              });

            if (rdvError) {
              console.error("Error creating RDV:", rdvError);
              continue;
            }

            imported++;
          } catch (e) {
            console.error("Event processing error:", e);
          }
        }

        // Update sync history
        if (imported > 0 || updated > 0) {
          await supabase.from("google_sync_history").insert({
            user_id: userId,
            sync_type: "import",
            status: "success",
            started_at: startedAt,
            completed_at: new Date().toISOString(),
            events_imported: imported,
            events_updated: updated,
            events_skipped: skipped,
          });
        }

        console.log(`User ${userId}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
        totalSynced++;
      } catch (userError) {
        console.error(`Error syncing user ${userId}:`, userError);
        totalErrors++;
      }
    }

    console.log(`Sync complete: ${totalSynced} users synced, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        errors: totalErrors,
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
