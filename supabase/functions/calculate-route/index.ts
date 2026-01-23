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
  source: "google" | "osrm" | "fallback";
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

    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    // Try Google Maps Directions API first
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}&mode=driving&language=fr&key=${GOOGLE_MAPS_API_KEY}`;
        
        const googleResponse = await fetch(googleUrl);
        const googleData = await googleResponse.json();

        if (googleData.status === "OK" && googleData.routes?.length > 0) {
          const route = googleData.routes[0];
          const leg = route.legs[0];
          
          const result: RouteResponse = {
            distance_km: Math.round(leg.distance.value / 100) / 10, // meters to km
            duration_minutes: Math.round(leg.duration.value / 60), // seconds to minutes
            source: "google",
          };

          console.log(`Google Maps: ${result.distance_km}km, ${result.duration_minutes}min`);

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } else {
          console.warn("Google Maps API error:", googleData.status, googleData.error_message);
        }
      } catch (googleError) {
        console.error("Google Maps API failed:", googleError);
      }
    }

    // Fallback to OSRM if Google Maps fails or is not configured
    console.log("Falling back to OSRM...");
    
    const osrmResponse = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`,
      {
        headers: {
          "User-Agent": "SolarFlow-CRM/1.0",
        },
      }
    );

    const osrmData = await osrmResponse.json();

    if (osrmData.code === "Ok" && osrmData.routes?.length > 0) {
      const route = osrmData.routes[0];
      const result: RouteResponse = {
        distance_km: Math.round(route.distance / 100) / 10,
        duration_minutes: Math.round(route.duration / 60),
        source: "osrm",
      };

      console.log(`OSRM: ${result.distance_km}km, ${result.duration_minutes}min`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Final fallback: Haversine formula
    console.log("Falling back to Haversine calculation...");
    
    const R = 6371;
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLon = (destination.lon - origin.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDistance = R * c;
    
    const estimatedDistance = straightDistance * 1.3;
    const estimatedMinutes = Math.round((estimatedDistance / 50) * 60);

    const result: RouteResponse = {
      distance_km: Math.round(estimatedDistance * 10) / 10,
      duration_minutes: estimatedMinutes,
      source: "fallback",
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
