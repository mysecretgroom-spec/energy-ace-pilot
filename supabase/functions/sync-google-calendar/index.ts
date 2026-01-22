import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

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

interface ParsedRdv {
  client_name: string;
  client_email?: string;
  client_phone?: string;
  address?: string;
  date_heure: string;
  duration_minutes: number;
  type_projet?: string;
  notes?: string;
  google_event_id: string;
}

// Extract phone number from text
function extractPhone(text: string): string | null {
  const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
  const match = text.match(phoneRegex);
  return match ? match[0].replace(/[\s.-]/g, '') : null;
}

// Parse event to RDV format
function parseEventToRdv(event: CalendarEvent): ParsedRdv | null {
  if (!event.start.dateTime) {
    // Skip all-day events
    return null;
  }

  const startDate = new Date(event.start.dateTime);
  const endDate = new Date(event.end.dateTime || event.start.dateTime);
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  // Extract client info from summary or attendees
  let clientName = event.summary || "Client inconnu";
  let clientEmail: string | undefined;
  let clientPhone: string | undefined;

  // Check attendees for client info
  if (event.attendees && event.attendees.length > 0) {
    const firstAttendee = event.attendees[0];
    if (firstAttendee.displayName) {
      clientName = firstAttendee.displayName;
    }
    clientEmail = firstAttendee.email;
  }

  // Try to extract phone from description
  if (event.description) {
    const phone = extractPhone(event.description);
    if (phone) clientPhone = phone;
  }

  // Detect project type from summary/description
  let typeProjet = "autre";
  const fullText = `${event.summary || ""} ${event.description || ""}`.toLowerCase();
  
  if (fullText.includes("photovoltaique") || fullText.includes("solaire") || fullText.includes("panneau")) {
    typeProjet = "photovoltaique";
  } else if (fullText.includes("pompe") || fullText.includes("pac") || fullText.includes("chaleur")) {
    typeProjet = "pompe_a_chaleur";
  } else if (fullText.includes("isolation") || fullText.includes("combles") || fullText.includes("ite")) {
    typeProjet = "isolation";
  } else if (fullText.includes("chauffe-eau") || fullText.includes("ballon") || fullText.includes("thermodynamique")) {
    typeProjet = "chauffe_eau";
  }

  return {
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    address: event.location,
    date_heure: startDate.toISOString(),
    duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
    type_projet: typeProjet,
    notes: event.description,
    google_event_id: event.id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromAuth(req.headers.get("Authorization"));
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google not connected", code: "GOOGLE_NOT_CONNECTED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "sync";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "sync") {
      // Get sync parameters
      const daysAhead = parseInt(url.searchParams.get("daysAhead") || "30");
      const daysBefore = parseInt(url.searchParams.get("daysBefore") || "7");
      
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - daysBefore);
      
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + daysAhead);

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
        const error = await calendarResponse.text();
        console.error("Calendar API error:", error);
        throw new Error("Failed to fetch calendar events");
      }

      const calendarData = await calendarResponse.json();
      const events: CalendarEvent[] = calendarData.items || [];

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const event of events) {
        try {
          const parsed = parseEventToRdv(event);
          if (!parsed) {
            skipped++;
            continue;
          }

          // Check if RDV already exists for this Google event
          const { data: existingRdv } = await supabase
            .from("rdv")
            .select("id")
            .eq("user_id", userId)
            .eq("google_event_id", parsed.google_event_id)
            .maybeSingle();

          if (existingRdv) {
            // Update existing RDV
            await supabase
              .from("rdv")
              .update({
                date_heure: parsed.date_heure,
                duree_minutes: parsed.duration_minutes,
                type_projet: parsed.type_projet,
                commentaire: parsed.notes,
              })
              .eq("id", existingRdv.id);
            updated++;
            continue;
          }

          // Find or create client
          let clientId: string | null = null;

          if (parsed.client_email) {
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id")
              .eq("user_id", userId)
              .eq("email", parsed.client_email)
              .maybeSingle();

            if (existingClient) {
              clientId = existingClient.id;
            }
          }

          if (!clientId && parsed.client_phone) {
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id")
              .eq("user_id", userId)
              .eq("telephone", parsed.client_phone)
              .maybeSingle();

            if (existingClient) {
              clientId = existingClient.id;
            }
          }

          if (!clientId) {
            // Create new client
            const nameParts = parsed.client_name.split(" ");
            const prenom = nameParts[0] || "";
            const nom = nameParts.slice(1).join(" ") || parsed.client_name;

            const { data: newClient, error: clientError } = await supabase
              .from("clients")
              .insert({
                user_id: userId,
                nom,
                prenom,
                email: parsed.client_email,
                telephone: parsed.client_phone,
                adresse: parsed.address,
                source: "google_calendar",
              })
              .select("id")
              .single();

            if (clientError) {
              console.error("Error creating client:", clientError);
              errors.push(`Client creation failed for ${parsed.client_name}`);
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
              date_heure: parsed.date_heure,
              duree_minutes: parsed.duration_minutes,
              type_projet: parsed.type_projet,
              statut: "planifie",
              commentaire: parsed.notes,
              google_event_id: parsed.google_event_id,
              source: "google_calendar",
            });

          if (rdvError) {
            console.error("Error creating RDV:", rdvError);
            errors.push(`RDV creation failed for ${parsed.client_name}`);
            continue;
          }

          imported++;
        } catch (e) {
          console.error("Event processing error:", e);
          errors.push(`Error processing event: ${event.summary}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imported,
          updated,
          skipped,
          total: events.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
