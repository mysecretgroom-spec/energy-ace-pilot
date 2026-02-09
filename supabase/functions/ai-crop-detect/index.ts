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

    const { images, local_corners } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const img of images) {
      try {
        // Build prompt: if local detection provided corners, ask AI to validate/refine
        const localHint = local_corners?.[img.id];
        let promptText: string;

        if (localHint) {
          promptText = `You are a document edge detector. This photo contains a paper document (possibly tilted, rotated, or at an angle). Find the EXACT 4 corners of the document's physical edges. A local algorithm suggests: TL(${localHint.topLeft.x.toFixed(3)},${localHint.topLeft.y.toFixed(3)}) TR(${localHint.topRight.x.toFixed(3)},${localHint.topRight.y.toFixed(3)}) BR(${localHint.bottomRight.x.toFixed(3)},${localHint.bottomRight.y.toFixed(3)}) BL(${localHint.bottomLeft.x.toFixed(3)},${localHint.bottomLeft.y.toFixed(3)}). Validate or correct these. IMPORTANT: The corners should trace the actual document edges even if the document is tilted — do NOT force a rectangle. Return normalized 0-1 coordinates. Response: {"needs_crop":true,"confidence":0.95,"corners":{"topLeft":{"x":...,"y":...},"topRight":{"x":...,"y":...},"bottomRight":{"x":...,"y":...},"bottomLeft":{"x":...,"y":...}}}. If no document: {"needs_crop":false,"confidence":0}. JSON ONLY.`;
        } else {
          promptText = `You are a document edge detector. This photo contains a paper document (possibly tilted, rotated, or at an angle on a surface). Find the EXACT 4 corners where the document's physical edges meet. Trace the real edges precisely — the quad will likely be a trapezoid or parallelogram, NOT a perfect rectangle. Return the corners as normalized 0-1 coordinates (x=left-to-right, y=top-to-bottom) with a confidence score. Response: {"needs_crop":true,"confidence":0.95,"corners":{"topLeft":{"x":...,"y":...},"topRight":{"x":...,"y":...},"bottomRight":{"x":...,"y":...},"bottomLeft":{"x":...,"y":...}}}. If no document: {"needs_crop":false,"confidence":0}. JSON ONLY.`;
        }

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
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image_url", image_url: { url: img.base64 } },
                ],
              },
            ],
            max_tokens: 250,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`AI error for ${img.id}:`, response.status, errText);
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "Payment required" }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          results.push({ id: img.id, needs_crop: false, confidence: 0, error: "AI analysis failed" });
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ id: img.id, needs_crop: false, confidence: 0 });
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        results.push({ id: img.id, ...parsed });
      } catch (err) {
        console.error(`Error processing ${img.id}:`, err);
        results.push({ id: img.id, needs_crop: false, confidence: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-crop-detect error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
