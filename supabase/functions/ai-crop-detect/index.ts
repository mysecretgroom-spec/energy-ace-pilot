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

    const { images } = await req.json();
    // images: Array<{ id: string, base64: string }>

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process images in parallel (max 5 concurrent)
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (img: { id: string; base64: string }) => {
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
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `Analyze this image. Is there a document (paper, card, receipt, invoice, ID, etc.) visible in the photo that needs to be cropped out from the background?

If YES, return the crop coordinates as a JSON object with these normalized values (0 to 1, relative to image width/height):
{"needs_crop": true, "crop": {"x": <left>, "y": <top>, "width": <width>, "height": <height>}}

The crop rectangle should tightly fit the document edges with a small margin (2-3%).

If NO (the image is already a clean document scan, or no document is visible), return:
{"needs_crop": false}

IMPORTANT: Return ONLY the JSON object, no other text.`,
                      },
                      {
                        type: "image_url",
                        image_url: { url: img.base64 },
                      },
                    ],
                  },
                ],
              }),
            });

            if (!response.ok) {
              const errText = await response.text();
              console.error(`AI error for ${img.id}:`, response.status, errText);
              return { id: img.id, needs_crop: false, error: "AI analysis failed" };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";
            
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              return { id: img.id, needs_crop: false };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return { id: img.id, ...parsed };
          } catch (err) {
            console.error(`Error processing ${img.id}:`, err);
            return { id: img.id, needs_crop: false, error: String(err) };
          }
        })
      );
      results.push(...batchResults);
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
