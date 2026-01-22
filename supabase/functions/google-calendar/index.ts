import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

serve(async (req) => {
  // Handle CORS
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
    const action = url.searchParams.get("action") || "list";

    let result;

    switch (action) {
      case "list": {
        // List upcoming events
        const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
        const timeMax = url.searchParams.get("timeMax");
        const maxResults = url.searchParams.get("maxResults") || "10";

        const params = new URLSearchParams({
          timeMin,
          maxResults,
          singleEvents: "true",
          orderBy: "startTime",
        });
        if (timeMax) params.append("timeMax", timeMax);

        const response = await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Calendar API error:", error);
          throw new Error("Failed to fetch calendar events");
        }

        result = await response.json();
        break;
      }

      case "create": {
        // Create a new event
        const body = await req.json();
        const { summary, description, start, end, attendees } = body;

        const event = {
          summary,
          description,
          start: { dateTime: start, timeZone: "Europe/Paris" },
          end: { dateTime: end, timeZone: "Europe/Paris" },
          attendees: attendees?.map((email: string) => ({ email })),
        };

        const response = await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Calendar create error:", error);
          throw new Error("Failed to create calendar event");
        }

        result = await response.json();
        break;
      }

      case "delete": {
        // Delete an event
        const eventId = url.searchParams.get("eventId");
        if (!eventId) {
          throw new Error("eventId is required");
        }

        const response = await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok && response.status !== 204) {
          const error = await response.text();
          console.error("Calendar delete error:", error);
          throw new Error("Failed to delete calendar event");
        }

        result = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google Calendar error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
