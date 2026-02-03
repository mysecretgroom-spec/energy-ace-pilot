import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get RDVs without coordinates that have an address
    const { data: rdvs, error: fetchError } = await supabase
      .from("rdv")
      .select("id, adresse, client_id")
      .or("latitude.is.null,longitude.is.null")
      .not("adresse", "is", null)
      .not("adresse", "eq", "")
      .limit(50);

    if (fetchError) throw fetchError;

    if (!rdvs || rdvs.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No RDVs without coordinates found",
        processed: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Batch Geocode] Found ${rdvs.length} RDVs to geocode`);

    let successCount = 0;
    let failCount = 0;
    const results: Array<{ rdv_id: string; success: boolean; error?: string }> = [];

    for (const rdv of rdvs) {
      try {
        // Call geocode-address function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode-address`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: rdv.adresse }),
        });

        if (!response.ok) {
          console.error(`[Batch Geocode] Failed for RDV ${rdv.id}: HTTP ${response.status}`);
          failCount++;
          results.push({ rdv_id: rdv.id, success: false, error: `HTTP ${response.status}` });
          continue;
        }

        const geocodeResult = await response.json();

        if (geocodeResult.latitude && geocodeResult.longitude) {
          // Update RDV with coordinates
          const { error: updateError } = await supabase
            .from("rdv")
            .update({
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
            })
            .eq("id", rdv.id);

          if (updateError) {
            console.error(`[Batch Geocode] Update failed for RDV ${rdv.id}:`, updateError);
            failCount++;
            results.push({ rdv_id: rdv.id, success: false, error: updateError.message });
          } else {
            console.log(`[Batch Geocode] ✓ RDV ${rdv.id} geocoded: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
            successCount++;
            results.push({ rdv_id: rdv.id, success: true });
          }
        } else {
          console.log(`[Batch Geocode] No coordinates for RDV ${rdv.id}`);
          failCount++;
          results.push({ rdv_id: rdv.id, success: false, error: "No coordinates returned" });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[Batch Geocode] Error for RDV ${rdv.id}:`, err);
        failCount++;
        results.push({ rdv_id: rdv.id, success: false, error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      message: `Geocoded ${successCount}/${rdvs.length} RDVs`,
      processed: rdvs.length,
      success: successCount,
      failed: failCount,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Batch Geocode] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
