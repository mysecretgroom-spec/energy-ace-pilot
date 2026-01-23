import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  address: string;
}

interface GeocodeResponse {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  corrected?: boolean;
  original_address?: string;
  correction_applied?: string;
}

// Geocode an address using Nominatim
async function geocodeWithNominatim(address: string): Promise<{ lat: number; lon: number; display_name: string } | null> {
  const encodedAddress = encodeURIComponent(address);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=fr`,
    {
      headers: {
        "User-Agent": "SolarFlow-CRM/1.0",
      },
    }
  );

  const data = await response.json();
  
  if (data && data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display_name: data[0].display_name,
    };
  }
  
  return null;
}

// Use AI to correct the address
async function correctAddressWithAI(address: string): Promise<{ correctedAddress: string; correction: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.log("[Geocode] LOVABLE_API_KEY not configured, skipping AI correction");
    return null;
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en adresses françaises. Quand une adresse ne peut pas être géocodée, tu dois analyser les erreurs possibles et proposer une correction.

Erreurs courantes:
- Fautes de frappe dans le nom de rue
- Code postal incorrect ou inversé
- Ville mal orthographiée
- Rue qui n'existe pas dans cette ville
- Abréviations mal comprises (Bd, Av, Rue, etc.)

Tu dois retourner UNIQUEMENT un objet JSON valide avec:
- "corrected_address": l'adresse corrigée complète
- "correction": une brève explication de la correction

Si tu ne peux pas corriger l'adresse, retourne null.`,
          },
          {
            role: "user",
            content: `L'adresse suivante n'a pas pu être géocodée en France. Analyse et corrige si possible:

"${address}"

Retourne UNIQUEMENT le JSON, sans markdown ni explication.`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[Geocode AI] API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return null;
    }

    // Parse JSON response
    try {
      // Remove potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleanContent);
      
      if (parsed && parsed.corrected_address && parsed.corrected_address !== address) {
        return {
          correctedAddress: parsed.corrected_address,
          correction: parsed.correction || "Correction automatique",
        };
      }
    } catch (parseError) {
      console.error("[Geocode AI] JSON parse error:", parseError, "Content:", content);
    }

    return null;
  } catch (error) {
    console.error("[Geocode AI] Error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address }: GeocodeRequest = await req.json();

    if (!address) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[Geocode] Trying to geocode: "${address}"`);

    // First attempt: geocode the original address
    let geocodeResult = await geocodeWithNominatim(address);

    if (geocodeResult) {
      console.log(`[Geocode] Success on first attempt`);
      const result: GeocodeResponse = {
        latitude: geocodeResult.lat,
        longitude: geocodeResult.lon,
        formatted_address: geocodeResult.display_name,
        corrected: false,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[Geocode] First attempt failed, trying AI correction...`);

    // Second attempt: use AI to correct the address
    const aiCorrection = await correctAddressWithAI(address);

    if (aiCorrection) {
      console.log(`[Geocode] AI suggested: "${aiCorrection.correctedAddress}" (${aiCorrection.correction})`);
      
      // Try geocoding the corrected address
      geocodeResult = await geocodeWithNominatim(aiCorrection.correctedAddress);

      if (geocodeResult) {
        console.log(`[Geocode] Success with corrected address!`);
        const result: GeocodeResponse = {
          latitude: geocodeResult.lat,
          longitude: geocodeResult.lon,
          formatted_address: geocodeResult.display_name,
          corrected: true,
          original_address: address,
          correction_applied: aiCorrection.correction,
        };

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Third attempt: try with just city and postal code (simplified)
    const postalCodeMatch = address.match(/\b(\d{5})\b/);
    if (postalCodeMatch) {
      const postalCode = postalCodeMatch[1];
      const simplifiedAddress = address.replace(/^\d+\s*,?\s*/g, "").trim(); // Remove house number
      
      console.log(`[Geocode] Trying simplified: "${simplifiedAddress}"`);
      geocodeResult = await geocodeWithNominatim(simplifiedAddress);
      
      if (geocodeResult) {
        console.log(`[Geocode] Success with simplified address`);
        const result: GeocodeResponse = {
          latitude: geocodeResult.lat,
          longitude: geocodeResult.lon,
          formatted_address: geocodeResult.display_name,
          corrected: true,
          original_address: address,
          correction_applied: "Recherche simplifiée sans numéro de rue",
        };

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    console.log(`[Geocode] All attempts failed for: "${address}"`);
    return new Response(JSON.stringify({ 
      error: "Address not found",
      original_address: address,
      message: "Impossible de géocoder cette adresse même après correction IA"
    }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[Geocode] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
