import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { image_base64, enhancement_type } = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = image_base64.startsWith("data:") ? image_base64 : `data:image/jpeg;base64,${image_base64}`;

    let prompt: string;
    switch (enhancement_type) {
      case "shadow_removal":
        prompt = "Remove all shadows from this document photo. The result should look like a clean flat scan with even lighting. Remove finger shadows, table shadows, and any uneven lighting. Keep the text and content perfectly readable. Return a clean, evenly-lit version.";
        break;
      case "unwrinkle":
        prompt = "Digitally unwrinkle and flatten this document image. Remove any visible creases, folds, or wrinkles while preserving all text and content. The result should look like a perfectly flat, clean document.";
        break;
      case "clean_background":
        prompt = "Clean up this document photo: remove the background (table, desk surface), make the document background pure white, remove any stains or marks that are not part of the document content. Keep all text perfectly readable.";
        break;
      default:
        prompt = "Enhance this document image for maximum readability: remove shadows, even out lighting, increase contrast of text, clean up the background to white, and make it look like a professional scan. Keep all text perfectly sharp and readable.";
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI enhance error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI enhancement failed: ${response.status}`);
    }

    const data = await response.json();
    const images = data.choices?.[0]?.message?.images;
    
    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No enhanced image returned" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enhancedImageUrl = images[0].image_url?.url;

    return new Response(JSON.stringify({
      success: true,
      enhanced_image: enhancedImageUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enhance-document-image error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
