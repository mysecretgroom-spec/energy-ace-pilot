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
  source?: string;
}

// ─── BAN (Base Adresse Nationale) — primary geocoder ───
interface BANFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    score: number;
    postcode?: string;
    city?: string;
    type: string; // housenumber | street | locality | municipality
  };
}

async function geocodeBAN(query: string, postcode?: string, cityHint?: string): Promise<BANFeature[]> {
  const params = new URLSearchParams({ q: query, limit: "5" });
  if (postcode) params.set("postcode", postcode);
  // cityHint is used in scoring, not sent to API (it would restrict too much)

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?${params}`;
    console.log(`[Geocode:BAN] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Geocode:BAN] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.features || []) as BANFeature[];
  } catch (e) {
    console.warn("[Geocode:BAN] fetch error:", e);
    return [];
  }
}

function scoreBAN(f: BANFeature, expectedPostal?: string, expectedCity?: string): number {
  let s = f.properties.score * 100; // BAN score is 0-1

  // Type bonus: precise types are better
  if (f.properties.type === "housenumber") s += 30;
  else if (f.properties.type === "street") s += 15;
  else if (f.properties.type === "locality") s += 10;

  // Postal code match
  if (expectedPostal && f.properties.postcode) {
    if (f.properties.postcode === expectedPostal) s += 50;
    else if (f.properties.postcode.substring(0, 2) === expectedPostal.substring(0, 2)) s += 10;
    else s -= 100; // Wrong department
  }

  // City match
  if (expectedCity && f.properties.city) {
    const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_']/g, " ").trim();
    const a = norm(expectedCity), b = norm(f.properties.city);
    if (a === b) s += 40;
    else if (a.includes(b) || b.includes(a)) s += 20;
  }

  return s;
}

function pickBestBAN(features: BANFeature[], postal?: string, city?: string): BANFeature | null {
  if (!features.length) return null;
  const scored = features.map(f => ({ f, s: scoreBAN(f, postal, city) }));
  scored.sort((a, b) => b.s - a.s);
  // Require a minimum BAN score of 0.4 (very lenient)
  if (scored[0].f.properties.score < 0.35) return null;
  return scored[0].f;
}

function banToResponse(f: BANFeature, extra: Partial<GeocodeResponse> = {}): Response {
  const [lng, lat] = f.geometry.coordinates;
  const body: GeocodeResponse = {
    latitude: lat,
    longitude: lng,
    formatted_address: f.properties.label,
    corrected: false,
    approximate: f.properties.type === "municipality",
    source: "ban",
    ...extra,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ─── Nominatim fallback ───
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

async function geocodeNominatim(query: string): Promise<NominatimResult[]> {
  const encoded = encodeURIComponent(query);
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5&countrycodes=fr&addressdetails=1`,
        { headers: { "User-Agent": "SolarFlow-CRM/1.0" } }
      );
      const ct = response.headers.get("content-type") || "";
      if (!response.ok || !ct.includes("application/json")) {
        if (attempt < 1) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return [];
      }
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.map((r: any) => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        display_name: r.display_name,
        address: r.address,
      }));
    } catch {
      if (attempt < 1) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return [];
    }
  }
  return [];
}

function getDepartment(postalCode: string): string {
  if (postalCode.startsWith("97") || postalCode.startsWith("98")) return postalCode.substring(0, 3);
  return postalCode.substring(0, 2);
}

function scoreNominatim(r: NominatimResult, city?: string, postal?: string): number {
  let s = 0;
  if (postal) {
    const rp = r.address?.postcode;
    if (rp === postal) s += 100;
    else if (rp && getDepartment(rp) === getDepartment(postal)) s += 50;
    else s -= 200;
  }
  if (city) {
    const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_']/g, " ").trim();
    const exp = norm(city);
    const candidates = [r.address?.city, r.address?.town, r.address?.village, r.address?.municipality].filter(Boolean).map(c => norm(c!));
    if (candidates.some(c => c === exp || c.includes(exp) || exp.includes(c))) s += 80;
  }
  return s;
}

function pickBestNominatim(results: NominatimResult[], city?: string, postal?: string): NominatimResult | null {
  if (!results.length) return null;
  const scored = results.map(r => ({ r, s: scoreNominatim(r, city, postal) }));
  scored.sort((a, b) => b.s - a.s);
  if (scored[0].s >= 50) return scored[0].r;
  return null;
}

function nominatimToResponse(r: NominatimResult, extra: Partial<GeocodeResponse> = {}): Response {
  const body: GeocodeResponse = {
    latitude: r.lat,
    longitude: r.lon,
    formatted_address: r.display_name,
    corrected: false,
    approximate: false,
    source: "nominatim",
    ...extra,
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

    // ── Step 1: BAN full address (with postcode filter if available) ──
    const banResults = await geocodeBAN(address, postal_code, city);
    const bestBan = pickBestBAN(banResults, postal_code, city);
    if (bestBan) {
      console.log(`[Geocode] ✓ BAN match: ${bestBan.properties.label} (score=${bestBan.properties.score}, type=${bestBan.properties.type})`);
      return banToResponse(bestBan);
    }

    // ── Step 2: BAN structured — extract street, combine with city/cp ──
    if (city && postal_code) {
      const streetPart = address
        .replace(new RegExp(postal_code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "")
        .replace(new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (streetPart.length > 3) {
        const structured = `${streetPart} ${postal_code} ${city}`;
        console.log(`[Geocode] BAN structured: "${structured}"`);
        const banStructured = await geocodeBAN(structured, postal_code, city);
        const bestStructured = pickBestBAN(banStructured, postal_code, city);
        if (bestStructured) {
          console.log(`[Geocode] ✓ BAN structured match: ${bestStructured.properties.label}`);
          return banToResponse(bestStructured, { corrected: true, correction_applied: "Recherche structurée BAN" });
        }
      }
    }

    // ── Step 3: Nominatim fallback ──
    console.log(`[Geocode] BAN failed, trying Nominatim...`);
    const nomResults = await geocodeNominatim(address);
    const bestNom = pickBestNominatim(nomResults, city, postal_code);
    if (bestNom) {
      // Cross-validate with BAN: send Nominatim coords to BAN reverse
      try {
        const reverseUrl = `https://api-adresse.data.gouv.fr/reverse/?lon=${bestNom.lon}&lat=${bestNom.lat}`;
        const reverseRes = await fetch(reverseUrl);
        if (reverseRes.ok) {
          const reverseData = await reverseRes.json();
          const rf = reverseData.features?.[0] as BANFeature | undefined;
          if (rf && postal_code && rf.properties.postcode !== postal_code) {
            console.warn(`[Geocode] Nominatim/BAN cross-validation mismatch: Nominatim CP=${bestNom.address?.postcode}, BAN reverse CP=${rf.properties.postcode}, expected=${postal_code}`);
            // Don't use this result — fall through to city fallback
          } else {
            console.log(`[Geocode] ✓ Nominatim match (BAN-validated): ${bestNom.display_name}`);
            return nominatimToResponse(bestNom);
          }
        }
      } catch {
        // If reverse fails, still use Nominatim result
        console.log(`[Geocode] ✓ Nominatim match (no BAN validation): ${bestNom.display_name}`);
        return nominatimToResponse(bestNom);
      }
    }

    // ── Step 4: BAN city+CP only (approximate) ──
    if (city && postal_code) {
      const cityQuery = `${city}`;
      console.log(`[Geocode] BAN city fallback: "${cityQuery}" postcode=${postal_code}`);
      const cityResults = await geocodeBAN(cityQuery, postal_code);
      if (cityResults.length > 0) {
        const best = cityResults[0];
        console.log(`[Geocode] ✓ BAN city fallback: ${best.properties.label}`);
        return banToResponse(best, {
          corrected: true,
          approximate: true,
          original_address: address,
          correction_applied: "Géolocalisation par ville + code postal",
        });
      }
    }

    // ── Step 5: CP-only fallback ──
    const postalMatch = (postal_code || address).match(/\b(\d{5})\b/);
    if (postalMatch) {
      const cp = postalMatch[1];
      console.log(`[Geocode] BAN CP-only fallback: "${cp}"`);
      const cpResults = await geocodeBAN(cp);
      if (cpResults.length > 0) {
        return banToResponse(cpResults[0], {
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
