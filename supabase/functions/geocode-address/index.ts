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

interface BANFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    score: number;
    postcode?: string;
    city?: string;
    type: string;
    name?: string;
    housenumber?: string;
    street?: string;
  };
}

// ─── BAN helpers ───

async function banSearch(query: string, postcode?: string): Promise<BANFeature[]> {
  const params = new URLSearchParams({ q: query, limit: "10" });
  if (postcode) params.set("postcode", postcode);
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?${params}`;
    console.log(`[Geocode:BAN] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []) as BANFeature[];
  } catch (e) {
    console.warn("[Geocode:BAN] fetch error:", e);
    return [];
  }
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_']/g, " ").replace(/\s+/g, " ").trim();

function cityMatch(a: string, b: string): boolean {
  const na = normalize(a), nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Fuzzy street match: check if the street tokens from the query appear in the BAN result */
function streetFuzzyMatch(queryStreet: string, banLabel: string): number {
  const qTokens = normalize(queryStreet).split(" ").filter(t => t.length > 2);
  const bNorm = normalize(banLabel);
  if (!qTokens.length) return 0;
  let matched = 0;
  for (const t of qTokens) {
    if (bNorm.includes(t)) matched++;
  }
  return matched / qTokens.length; // 0-1 ratio
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

/**
 * Score a BAN feature with STRICT city/postal validation.
 * City + postal code correctness is mandatory; street is fuzzy-matched.
 */
function scoreBAN(
  f: BANFeature,
  expectedPostal?: string,
  expectedCity?: string,
  streetQuery?: string
): { score: number; cityOk: boolean; postalOk: boolean } {
  let s = 0;
  let postalOk = true;
  let cityOk = true;

  // ── Postal code: MANDATORY match ──
  if (expectedPostal && f.properties.postcode) {
    if (f.properties.postcode === expectedPostal) {
      s += 100;
    } else if (f.properties.postcode.substring(0, 2) === expectedPostal.substring(0, 2)) {
      s -= 50; // same department but wrong commune
      postalOk = false;
    } else {
      s -= 500; // completely wrong
      postalOk = false;
    }
  }

  // ── City: MANDATORY match ──
  if (expectedCity && f.properties.city) {
    if (cityMatch(expectedCity, f.properties.city)) {
      s += 80;
    } else {
      s -= 300;
      cityOk = false;
    }
  }

  // ── Street: fuzzy match (bonus, not mandatory) ──
  if (streetQuery) {
    const ratio = streetFuzzyMatch(streetQuery, f.properties.label);
    s += ratio * 60; // up to +60 for perfect street match
  }

  // ── Type bonus ──
  if (f.properties.type === "housenumber") s += 30;
  else if (f.properties.type === "street") s += 15;
  else if (f.properties.type === "locality") s += 10;

  // Base BAN score
  s += f.properties.score * 20;

  return { score: s, cityOk, postalOk };
}

function pickBestBAN(
  features: BANFeature[],
  postal?: string,
  city?: string,
  street?: string
): BANFeature | null {
  if (!features.length) return null;

  const scored = features.map(f => {
    const r = scoreBAN(f, postal, city, street);
    return { f, ...r };
  });

  // First: only consider results where city AND postal match
  const valid = scored.filter(x => x.cityOk && x.postalOk);
  if (valid.length) {
    valid.sort((a, b) => b.score - a.score);
    if (valid[0].f.properties.score >= 0.3) {
      return valid[0].f;
    }
  }

  // If no valid result, don't return anything with wrong city/postal
  return null;
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

function nominatimCityMatch(r: NominatimResult, city: string): boolean {
  const candidates = [r.address?.city, r.address?.town, r.address?.village, r.address?.municipality].filter(Boolean);
  return candidates.some(c => cityMatch(c!, city));
}

function pickBestNominatim(results: NominatimResult[], city?: string, postal?: string): NominatimResult | null {
  if (!results.length) return null;
  // Filter by postal + city first
  const filtered = results.filter(r => {
    if (postal && r.address?.postcode !== postal) return false;
    if (city && !nominatimCityMatch(r, city)) return false;
    return true;
  });
  return filtered.length ? filtered[0] : null;
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

/** Extract the street part from the full address by removing postal/city */
function extractStreet(address: string, city?: string, postalCode?: string): string {
  let street = address;
  if (postalCode) {
    street = street.replace(new RegExp(postalCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "");
  }
  if (city) {
    street = street.replace(new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "");
  }
  return street.replace(/[,\s]+/g, " ").trim();
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

    const streetPart = extractStreet(address, city, postal_code);
    console.log(`[Geocode] Street extracted: "${streetPart}"`);

    // ── Strategy 1: Full structured query "street CP city" with postcode filter ──
    if (city && postal_code && streetPart.length > 2) {
      const structuredQuery = `${streetPart} ${postal_code} ${city}`;
      console.log(`[Geocode] Step 1 — Structured: "${structuredQuery}"`);
      const results = await banSearch(structuredQuery, postal_code);
      const best = pickBestBAN(results, postal_code, city, streetPart);
      if (best) {
        console.log(`[Geocode] ✓ Structured match: ${best.properties.label} (type=${best.properties.type})`);
        return banToResponse(best);
      }
    }

    // ── Strategy 2: BAN with raw address + postcode filter ──
    {
      console.log(`[Geocode] Step 2 — Raw address with postcode filter`);
      const results = await banSearch(address, postal_code);
      const best = pickBestBAN(results, postal_code, city, streetPart);
      if (best) {
        console.log(`[Geocode] ✓ Raw match: ${best.properties.label}`);
        return banToResponse(best);
      }
    }

    // ── Strategy 3: BAN street-only in city context ──
    if (city && postal_code && streetPart.length > 2) {
      console.log(`[Geocode] Step 3 — Street-only: "${streetPart}" in ${postal_code}`);
      const results = await banSearch(streetPart, postal_code);
      const best = pickBestBAN(results, postal_code, city, streetPart);
      if (best) {
        console.log(`[Geocode] ✓ Street-only match: ${best.properties.label}`);
        return banToResponse(best, { corrected: true, correction_applied: "Recherche par rue dans la commune" });
      }
    }

    // ── Strategy 4: Nominatim fallback (strict city/postal filter) ──
    if (city && postal_code) {
      console.log(`[Geocode] Step 4 — Nominatim fallback`);
      const fullQuery = `${streetPart} ${postal_code} ${city}`;
      const nomResults = await geocodeNominatim(fullQuery);
      const bestNom = pickBestNominatim(nomResults, city, postal_code);
      if (bestNom) {
        // Cross-validate with BAN reverse
        try {
          const reverseUrl = `https://api-adresse.data.gouv.fr/reverse/?lon=${bestNom.lon}&lat=${bestNom.lat}`;
          const reverseRes = await fetch(reverseUrl);
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json();
            const rf = reverseData.features?.[0] as BANFeature | undefined;
            if (rf && rf.properties.postcode === postal_code) {
              console.log(`[Geocode] ✓ Nominatim (BAN-validated): ${bestNom.display_name}`);
              return nominatimToResponse(bestNom);
            } else {
              console.warn(`[Geocode] Nominatim/BAN cross-validation mismatch, skipping`);
            }
          }
        } catch {
          // If reverse fails, still use Nominatim if city/postal matched
          console.log(`[Geocode] ✓ Nominatim (no BAN validation): ${bestNom.display_name}`);
          return nominatimToResponse(bestNom);
        }
      }
    }

    // ── Strategy 5: BAN city+CP approximate (centroid) ──
    if (city && postal_code) {
      console.log(`[Geocode] Step 5 — City centroid fallback: "${city}" ${postal_code}`);
      const cityResults = await banSearch(city, postal_code);
      if (cityResults.length > 0) {
        // Pick the municipality-type result
        const muni = cityResults.find(f => f.properties.type === "municipality") || cityResults[0];
        console.log(`[Geocode] ✓ City centroid: ${muni.properties.label}`);
        return banToResponse(muni, {
          corrected: true,
          approximate: true,
          original_address: address,
          correction_applied: "Géolocalisation par ville + code postal (rue non trouvée)",
        });
      }
    }

    // ── Strategy 6: CP-only fallback ──
    const postalMatch = (postal_code || address).match(/\b(\d{5})\b/);
    if (postalMatch) {
      const cp = postalMatch[1];
      console.log(`[Geocode] Step 6 — CP-only: "${cp}"`);
      const cpResults = await banSearch(cp);
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
