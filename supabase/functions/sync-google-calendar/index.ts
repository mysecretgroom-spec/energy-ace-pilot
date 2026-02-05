import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const CALENDAR_API_BASE = "https://gateway.lovable.dev/google_calendar/calendar/v3";

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  attendees?: { email: string; displayName?: string }[];
  status?: string; // cancelled, confirmed, tentative
}

interface ParsedRdv {
  client_name: string;
  client_email?: string;
  client_phone?: string;
  address?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  date_heure: string;
  duration_minutes: number;
  type_projet?: string;
  notes?: string;
  google_event_id: string;
}

// Extract phone number from text
function extractPhone(text: string): string | null {
  // More robust phone regex - handles various formats
  const phoneRegex = /(?:(?:\+|00)33[\s.-]*|0)[1-9](?:[\s.-]*\d{2}){4}/g;
  const match = text.match(phoneRegex);
  if (!match) return null;
  // Normalize to format without spaces/dots
  let phone = match[0].replace(/[\s.-]/g, '');
  // Normalize +33 or 0033 to 0
  phone = phone.replace(/^(?:\+33|0033)/, '0');
  return phone;
}

// Extract client name from event summary - handles various formats
function extractClientName(summary: string): { nom: string; prenom: string } {
  if (!summary) return { nom: "Inconnu", prenom: "" };
  
  // Remove common prefixes like "RDV", "Rendez-vous", etc.
  let cleaned = summary
    .replace(/^(?:RDV|Rendez-vous|RV|Meeting|Réunion)\s*[-:]/i, '')
    .replace(/\s*[-–—]\s*(?:Photovoltaïque|PV|PAC|Pompe|Isolation|ITE|Solaire|Projet).*$/i, '')
    .trim();
  
  // If nothing left, use original
  if (!cleaned) cleaned = summary;
  
  // Try to split into first name / last name
  // Handle "NOM Prénom" or "Prénom NOM" patterns
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) {
    return { nom: summary, prenom: "" };
  } else if (parts.length === 1) {
    return { nom: parts[0], prenom: "" };
  } else {
    // Check if first part is all uppercase (likely NOM Prénom format)
    if (parts[0] === parts[0].toUpperCase() && parts[0].length > 1) {
      return { nom: parts[0], prenom: parts.slice(1).join(" ") };
    }
    // Otherwise assume Prénom NOM format
    return { prenom: parts[0], nom: parts.slice(1).join(" ") };
  }
}

// Extract address components from location string
function parseAddress(location: string | undefined): { 
  adresse: string | undefined; 
  ville: string | undefined; 
  code_postal: string | undefined; 
} {
  if (!location) return { adresse: undefined, ville: undefined, code_postal: undefined };
  
  // Try to extract postal code (5 digits in France)
  const postalMatch = location.match(/\b(\d{5})\b/);
  const code_postal = postalMatch ? postalMatch[1] : undefined;
  
  // Try to extract city (usually after postal code)
  let ville: string | undefined;
  if (postalMatch) {
    const afterPostal = location.substring(location.indexOf(postalMatch[0]) + 5).trim();
    // City is usually before a comma or end of string
    const cityMatch = afterPostal.match(/^[\s,]*([A-Za-zÀ-ÿ\s-]+)/);
    if (cityMatch) {
      ville = cityMatch[1].replace(/^[\s,]+/, '').trim();
    }
  }
  
  // Address is everything before the postal code, or the full string
  let adresse = location;
  if (postalMatch) {
    adresse = location.substring(0, location.indexOf(postalMatch[0])).replace(/[,\s]+$/, '').trim();
  }
  
  return { adresse: adresse || undefined, ville, code_postal };
}

// Parse event to RDV format
function parseEventToRdv(event: CalendarEvent): ParsedRdv | null {
  // Skip cancelled events
  if (event.status === "cancelled") {
    console.log(`Skipping cancelled event: ${event.summary}`);
    return null;
  }
  
  if (!event.start.dateTime) {
    // Skip all-day events
    console.log(`Skipping all-day event: ${event.summary}`);
    return null;
  }

  // Parse dates carefully
  let startDate: Date;
  let endDate: Date;
  
  try {
    startDate = new Date(event.start.dateTime);
    endDate = new Date(event.end.dateTime || event.start.dateTime);
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error(`Invalid date in event: ${event.summary}`, event.start, event.end);
      return null;
    }
  } catch (e) {
    console.error(`Date parsing error for event: ${event.summary}`, e);
    return null;
  }
  
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  // Extract client info from summary or attendees
  let clientName = event.summary || "Client inconnu";
  let clientEmail: string | undefined;
  let clientPhone: string | undefined;
  
  // Extract name parts using improved parser
  const nameParts = extractClientName(clientName);

  // Check attendees for client info (skip organizer's own email)
  if (event.attendees && event.attendees.length > 0) {
    // Find first non-organizer attendee
    for (const attendee of event.attendees) {
      // Skip if it looks like an organizer/company email
      if (attendee.email?.includes("@gmail.com") === false && 
          !attendee.email?.includes("commercial") &&
          !attendee.email?.includes("contact@")) {
        if (attendee.displayName) {
          const attendeeNames = extractClientName(attendee.displayName);
          nameParts.nom = attendeeNames.nom;
          nameParts.prenom = attendeeNames.prenom;
        }
        clientEmail = attendee.email;
        break;
      }
    }
  }

  // Try to extract phone from description AND summary
  const fullSearchText = `${event.summary || ""} ${event.description || ""}`;
  const phone = extractPhone(fullSearchText);
  if (phone) clientPhone = phone;
  
  // Also check location for phone (some people put it there)
  if (event.description) {
    // Try to extract email from description if not found
    if (!clientEmail) {
      const emailMatch = event.description.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) clientEmail = emailMatch[0];
    }
  }

  // Detect project type from summary/description
  let typeProjet = "autre";
  const fullText = fullSearchText.toLowerCase();
  
  if (fullText.includes("photovoltaique") || fullText.includes("photovoltaïque") || 
      fullText.includes("solaire") || fullText.includes("panneau") || fullText.includes("pv")) {
    typeProjet = "photovoltaique";
  } else if (fullText.includes("pompe") || fullText.includes("pac ") || 
             fullText.includes("chaleur") || fullText.includes("clim")) {
    typeProjet = "pompe_a_chaleur";
  } else if (fullText.includes("isolation") || fullText.includes("combles") || fullText.includes("ite")) {
    typeProjet = "isolation";
  } else if (fullText.includes("chauffe-eau") || fullText.includes("ballon") || fullText.includes("thermodynamique")) {
    typeProjet = "chauffe_eau";
  }
  
  // Parse address
  const addressParts = parseAddress(event.location);

  console.log(`Parsed event "${event.summary}":`, {
    nom: nameParts.nom,
    prenom: nameParts.prenom,
    phone: clientPhone,
    email: clientEmail,
    type: typeProjet,
    address: addressParts,
  });
  
  return {
    client_name: `${nameParts.prenom} ${nameParts.nom}`.trim(),
    client_email: clientEmail,
    client_phone: clientPhone,
    address: event.location, // Keep full address for notes
    date_heure: startDate.toISOString(),
    duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
    type_projet: typeProjet,
    notes: event.description,
    google_event_id: event.id,
    // Additional parsed fields
    ...addressParts,
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

      console.log(`Found ${events.length} calendar events to process`);

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
          
          console.log(`Processing event: ${event.summary} -> ${parsed.client_name}`);

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

          // Try to update client with address if we have it and client doesn't
          if (parsed.address) {
            await supabase
              .from("clients")
              .update({
                adresse: parsed.adresse || parsed.address,
                ville: parsed.ville,
                code_postal: parsed.code_postal,
              })
              .eq("id", clientId)
              .is("adresse", null);
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
              status: "nouveau",
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
