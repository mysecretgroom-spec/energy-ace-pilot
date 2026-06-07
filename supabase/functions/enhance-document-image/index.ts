import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { validateJson } from "../_shared/zodHttp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_BASE64 = 20_000_000;
// Accept raw base64 or a data:image/* URL. Both are pinned to base64 charset to
// defend the downstream AI gateway against arbitrary URLs / SSRF.
const dataUrlOrBase64 = z
  .string()
  .min(16)
  .max(MAX_IMAGE_BASE64)
  .regex(/^(data:image\/[a-zA-Z0-9.+-]+;base64,)?[A-Za-z0-9+/=\s]+$/, "Must be base64 or data:image URL");

const EnhanceSchema = z.object({
  image_base64: dataUrlOrBase64,
  enhancement_type: z.enum(["shadow_removal", "unwrinkle", "clean_background", "auto"]).default("auto"),
}).strict();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const v = await validateJson(req, EnhanceSchema, corsHeaders, { allowEmpty: false });
    if (!v.ok) return v.response;
    const { image_base64, enhancement_type } = v.data;

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

    // Timeout protection for image generation (45s max - image gen is slower)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

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
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
