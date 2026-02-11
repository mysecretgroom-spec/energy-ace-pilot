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
        // Build prompt: ask AI to analyze text lines AND document edges
        const localHint = local_corners?.[img.id];
        let promptText: string;

        const textAnalysisInstruction = `IMPORTANT: Before detecting edges, analyze the text lines in the image:
1. If the text lines are horizontal and evenly spaced, the document is ALREADY STRAIGHT — set "needs_crop" to false and "already_straight" to true.
2. If the document fills most of the image (>90% coverage) and text is horizontal, it does NOT need cropping — set "needs_crop" to false.
3. Only set "needs_crop" to true if the document is clearly at an angle on a surface, or there are visible non-document borders/background around it.
4. A scanned or photographed-from-above document that is already rectangular and fills the frame should NOT be cropped.`;

        if (localHint) {
          promptText = `You are a document edge detector and text alignment analyzer. This photo may contain a paper document.

${textAnalysisInstruction}

A local algorithm suggests corners: TL(${localHint.topLeft.x.toFixed(3)},${localHint.topLeft.y.toFixed(3)}) TR(${localHint.topRight.x.toFixed(3)},${localHint.topRight.y.toFixed(3)}) BR(${localHint.bottomRight.x.toFixed(3)},${localHint.bottomRight.y.toFixed(3)}) BL(${localHint.bottomLeft.x.toFixed(3)},${localHint.bottomLeft.y.toFixed(3)}). Validate or correct these.

If the document needs cropping, return normalized 0-1 coordinates:
{"needs_crop":true,"already_straight":false,"confidence":0.95,"text_angle_degrees":2.5,"corners":{"topLeft":{"x":...,"y":...},"topRight":{"x":...,"y":...},"bottomRight":{"x":...,"y":...},"bottomLeft":{"x":...,"y":...}}}

If the document is already straight/clean:
{"needs_crop":false,"already_straight":true,"confidence":0.95,"text_angle_degrees":0.2}

JSON ONLY.`;
        } else {
          promptText = `You are a document edge detector and text alignment analyzer. This photo may contain a paper document.

${textAnalysisInstruction}

If the document needs cropping (tilted on a surface with visible background), find the 4 corners and return:
{"needs_crop":true,"already_straight":false,"confidence":0.95,"text_angle_degrees":2.5,"corners":{"topLeft":{"x":...,"y":...},"topRight":{"x":...,"y":...},"bottomRight":{"x":...,"y":...},"bottomLeft":{"x":...,"y":...}}}

If the document is already straight/clean (text is horizontal, fills the frame):
{"needs_crop":false,"already_straight":true,"confidence":0.95,"text_angle_degrees":0.2}

Coordinates are normalized 0-1 (x=left-to-right, y=top-to-bottom). JSON ONLY.`;
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image_url", image_url: { url: img.base64 } },
                ],
              },
            ],
            max_tokens: 300,
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
