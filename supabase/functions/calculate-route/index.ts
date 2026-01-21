import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RouteRequest {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
}

interface RouteResponse {
  distance_km: number;
  duration_minutes: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination }: RouteRequest = await req.json();

    if (!origin || !destination) {
      return new Response(JSON.stringify({ error: "Origin and destination are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Use OSRM (OpenStreetMap Routing Machine) for free routing
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`,
      {
        headers: {
          "User-Agent": "SolarFlow-CRM/1.0",
        },
      }
    );

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      // Fallback to Haversine formula for straight-line distance
      const R = 6371; // Earth's radius in km
      const dLat = (destination.lat - origin.lat) * Math.PI / 180;
      const dLon = (destination.lon - origin.lon) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const straightDistance = R * c;
      
      // Estimate driving distance as 1.3x straight line
      const estimatedDistance = straightDistance * 1.3;
      // Estimate time at 50 km/h average
      const estimatedMinutes = Math.round((estimatedDistance / 50) * 60);

      const result: RouteResponse = {
        distance_km: Math.round(estimatedDistance * 10) / 10,
        duration_minutes: estimatedMinutes,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const route = data.routes[0];
    const result: RouteResponse = {
      distance_km: Math.round(route.distance / 100) / 10, // Convert meters to km
      duration_minutes: Math.round(route.duration / 60), // Convert seconds to minutes
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Routing error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
