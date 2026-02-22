import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeResponse {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  corrected?: boolean;
  approximate?: boolean;
  original_address?: string;
  correction_applied?: string;
}

interface NominatimResult {
  lat: number;
  lon: number;
  display_name: string;
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

// Geocode with Nominatim, returning multiple results for validation
async function geocodeNominatim(query: string, limit = 5): Promise<NominatimResult[]> {
  const encoded = encodeURIComponent(query);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=${limit}&countrycodes=fr&addressdetails=1`,
    { headers: { "User-Agent": "SolarFlow-CRM/1.0" } }
  );
  const data = await response.json();
  if (!data || !Array.isArray(data)) return [];
  return data.map((r: any) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    display_name: r.display_name,
    address: r.address,
  }));
}

// Extract the department prefix from a postal code (first 2 digits, or 3 for DOM-TOM)
function getDepartment(postalCode: string): string {
  if (postalCode.startsWith("97") || postalCode.startsWith("98")) return postalCode.substring(0, 3);
  return postalCode.substring(0, 2);
}

// Check if a Nominatim result matches the expected postal code
function matchesPostalCode(result: NominatimResult, expectedPostal: string): boolean {
  const resultPostal = result.address?.postcode;
  if (!resultPostal || !expectedPostal) return false;
  // Exact match
  if (resultPostal === expectedPostal) return true;
  // Same department (first 2 digits) — close enough for nearby communes
  return getDepartment(resultPostal) === getDepartment(expectedPostal);
}

// Check if the result's city name fuzzy-matches the expected city
function matchesCity(result: NominatimResult, expectedCity: string): boolean {
  if (!expectedCity) return false;
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_']/g, " ").trim();
  const expected = normalize(expectedCity);
  const candidates = [
    result.address?.city,
    result.address?.town,
    result.address?.village,
    result.address?.municipality,
  ].filter(Boolean).map(c => normalize(c!));
  
  return candidates.some(c => c === expected || c.includes(expected) || expected.includes(c));
}

// Score a result: higher = better match to expected city/postal
function scoreResult(result: NominatimResult, city?: string, postalCode?: string): number {
  let score = 0;
  if (postalCode) {
    const resultPostal = result.address?.postcode;
    if (resultPostal === postalCode) score += 100;
    else if (resultPostal && getDepartment(resultPostal) === getDepartment(postalCode)) score += 50;
    else score -= 200; // Wrong department = very bad
  }
  if (city && matchesCity(result, city)) score += 80;
  return score;
}

// Pick the best result that matches city/postal constraints
function pickBestResult(results: NominatimResult[], city?: string, postalCode?: string): NominatimResult | null {
  if (results.length === 0) return null;
  if (!city && !postalCode) return results[0]; // No constraints, take first

  const scored = results.map(r => ({ result: r, score: scoreResult(r, city, postalCode) }));
  scored.sort((a, b) => b.score - a.score);

  // Only accept if the best has a reasonable score (at least matching department)
  if (scored[0].score >= 50) return scored[0].result;

  // If no good match, return null to trigger fallback
  return null;
}

// Use AI to correct the address
async function correctAddressWithAI(address: string): Promise<{ correctedAddress: string; correction: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en adresses françaises. Corrige l'adresse pour qu'elle soit géocodable.
Retourne UNIQUEMENT un JSON: {"corrected_address": "...", "correction": "..."}
Si tu ne peux pas corriger, retourne null.`,
          },
          {
            role: "user",
            content: `Adresse non trouvée: "${address}"\nRetourne UNIQUEMENT le JSON.`,
          },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed?.corrected_address && parsed.corrected_address !== address) {
      return { correctedAddress: parsed.corrected_address, correction: parsed.correction || "Correction auto" };
    }
    return null;
  } catch { return null; }
}

function makeResponse(result: NominatimResult, opts: Partial<GeocodeResponse> = {}): Response {
  const body: GeocodeResponse = {
    latitude: result.lat,
    longitude: result.lon,
    formatted_address: result.display_name,
    corrected: false,
    approximate: false,
    ...opts,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, city, postal_code }: { address: string; city?: string; postal_code?: string } = await req.json();

    if (!address) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[Geocode] Input: address="${address}" city="${city || ""}" cp="${postal_code || ""}"`);

    // ──────────────────────────────────────────────────────────────
    // Step 1: Full address search, validate against city/postal
    // ──────────────────────────────────────────────────────────────
    const fullResults = await geocodeNominatim(address);
    const bestFull = pickBestResult(fullResults, city, postal_code);

    if (bestFull) {
      console.log(`[Geocode] ✓ Full address match: ${bestFull.display_name}`);
      return makeResponse(bestFull);
    }

    // ──────────────────────────────────────────────────────────────
    // Step 2: Try "street, city postal_code" structured query
    // ──────────────────────────────────────────────────────────────
    if (city && postal_code) {
      // Extract street part (remove postal/city from address if present)
      const streetPart = address
        .replace(new RegExp(postal_code, "g"), "")
        .replace(new RegExp(city, "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
      
      if (streetPart.length > 3) {
        const structured = `${streetPart}, ${postal_code} ${city}`;
        console.log(`[Geocode] Trying structured: "${structured}"`);
        const structuredResults = await geocodeNominatim(structured);
        const bestStructured = pickBestResult(structuredResults, city, postal_code);
        if (bestStructured) {
          console.log(`[Geocode] ✓ Structured match: ${bestStructured.display_name}`);
          return makeResponse(bestStructured, { corrected: true, correction_applied: "Recherche structurée ville+CP" });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Step 3: AI correction attempt
    // ──────────────────────────────────────────────────────────────
    console.log(`[Geocode] Trying AI correction...`);
    const aiCorrection = await correctAddressWithAI(address);
    if (aiCorrection) {
      console.log(`[Geocode] AI suggested: "${aiCorrection.correctedAddress}"`);
      const aiResults = await geocodeNominatim(aiCorrection.correctedAddress);
      const bestAi = pickBestResult(aiResults, city, postal_code);
      if (bestAi) {
        console.log(`[Geocode] ✓ AI-corrected match: ${bestAi.display_name}`);
        return makeResponse(bestAi, {
          corrected: true,
          original_address: address,
          correction_applied: aiCorrection.correction,
        });
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Step 4: City + postal code only (approximate, prioritize city name)
    // ──────────────────────────────────────────────────────────────
    if (city && postal_code) {
      const cityQuery = `${city} ${postal_code}, France`;
      console.log(`[Geocode] Trying city+CP: "${cityQuery}"`);
      const cityResults = await geocodeNominatim(cityQuery);
      const bestCity = pickBestResult(cityResults, city, postal_code);
      if (bestCity) {
        console.log(`[Geocode] ✓ City match: ${bestCity.display_name}`);
        return makeResponse(bestCity, {
          corrected: true,
          approximate: true,
          original_address: address,
          correction_applied: "Géolocalisation par ville + code postal",
        });
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Step 5: Postal code only — any commune in the same code postal
    // ──────────────────────────────────────────────────────────────
    const postalMatch = (postal_code || address).match(/\b(\d{5})\b/);
    if (postalMatch) {
      const cp = postalMatch[1];
      console.log(`[Geocode] Trying CP-only fallback: "${cp}"`);
      const cpResults = await geocodeNominatim(`${cp}, France`);
      if (cpResults.length > 0) {
        // Take whichever is in the right department
        const inDept = cpResults.find(r => r.address?.postcode && getDepartment(r.address.postcode) === getDepartment(cp));
        const best = inDept || cpResults[0];
        console.log(`[Geocode] ✓ CP fallback: ${best.display_name}`);
        return makeResponse(best, {
          corrected: true,
          approximate: true,
          original_address: address,
          correction_applied: `Géolocalisation approximative par code postal ${cp}`,
        });
      }
    }

    console.log(`[Geocode] ✗ All attempts failed for: "${address}"`);
    return new Response(JSON.stringify({
      error: "Address not found",
      original_address: address,
      message: "Impossible de géocoder cette adresse",
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
