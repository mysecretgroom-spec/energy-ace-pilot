import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface RdvData {
  id: string;
  client_name: string;
  date_heure: string;
  duree_minutes: number;
  type_projet: string;
  adresse?: string;
  commentaire?: string;
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

    const body = await req.json();
    const { rdv_id } = body;

    if (!rdv_id) {
      return new Response(
        JSON.stringify({ error: "rdv_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch RDV with client info
    const { data: rdv, error: rdvError } = await supabase
      .from("rdv")
      .select(`
        id,
        date_heure,
        duree_minutes,
        type_projet,
        adresse,
        commentaire,
        google_event_id,
        clients(nom, prenom, telephone, adresse, ville, code_postal)
      `)
      .eq("id", rdv_id)
      .eq("user_id", userId)
      .single();

    if (rdvError || !rdv) {
      console.error("RDV not found:", rdvError);
      return new Response(
        JSON.stringify({ error: "RDV not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientArray = rdv.clients as unknown as Array<{ nom: string; prenom: string | null; telephone: string | null; adresse: string | null; ville: string | null; code_postal: string | null }>;
    const clientData = clientArray?.[0] || { nom: "Client", prenom: null, telephone: null, adresse: null, ville: null, code_postal: null };
    const clientName = clientData.prenom ? `${clientData.prenom} ${clientData.nom}` : clientData.nom;

    // Build event location
    const location = rdv.adresse || [clientData.adresse, clientData.code_postal, clientData.ville].filter(Boolean).join(", ") || "";

    // Calculate end time
    const startDate = new Date(rdv.date_heure);
    const endDate = new Date(startDate.getTime() + (rdv.duree_minutes || 90) * 60000);

    // Project type labels
    const projectTypeLabels: Record<string, string> = {
      photovoltaique: "Photovoltaïque",
      pompe_chaleur: "Pompe à chaleur",
      isolation: "Isolation",
      ballon_thermo: "Ballon thermodynamique",
      autre: "Autre",
    };

    // Build Google Calendar event
    const calendarEvent = {
      summary: `RDV ${clientName} - ${projectTypeLabels[rdv.type_projet] || rdv.type_projet}`,
      description: [
        `Client: ${clientName}`,
        clientData.telephone ? `Tél: ${clientData.telephone}` : null,
        rdv.commentaire ? `\nNotes: ${rdv.commentaire}` : null,
        `\n---\nCréé depuis SolarFlow`,
      ].filter(Boolean).join("\n"),
      location,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "Europe/Paris",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "Europe/Paris",
      },
    };

    let googleEventId = rdv.google_event_id;
    let action: "created" | "updated" = "created";

    if (googleEventId) {
      // Update existing event
      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events/${googleEventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(calendarEvent),
        }
      );

      if (!response.ok) {
        // Event might have been deleted, create new one
        if (response.status === 404) {
          googleEventId = null;
        } else {
          const error = await response.text();
          console.error("Calendar update error:", error);
          throw new Error("Failed to update calendar event");
        }
      } else {
        action = "updated";
      }
    }

    if (!googleEventId) {
      // Create new event
      const response = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(calendarEvent),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Calendar create error:", error);
        throw new Error("Failed to create calendar event");
      }

      const createdEvent = await response.json();
      googleEventId = createdEvent.id;

      // Update RDV with Google event ID
      await supabase
        .from("rdv")
        .update({ google_event_id: googleEventId })
        .eq("id", rdv_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        google_event_id: googleEventId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push to calendar error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
