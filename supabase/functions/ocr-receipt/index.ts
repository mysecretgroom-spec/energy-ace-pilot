import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
  image_base64: string;
}

interface OCRResponse {
  montant: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  raw_text?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64 }: OCRRequest = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Use Lovable AI Gateway with Gemini for OCR
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
                text: `Analyse cette image de facture/ticket et extrais les informations suivantes en JSON:
- montant: le montant total en euros (nombre décimal)
- date: la date au format YYYY-MM-DD
- categorie: une des catégories suivantes: "carburant", "peage", "repas", "hotel", "parking", "autre"
- description: une courte description de la dépense

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Exemple:
{"montant": 45.50, "date": "2026-01-21", "categorie": "carburant", "description": "Plein essence Total"}

Si tu ne peux pas lire certaines informations, mets null pour ces champs.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: image_base64.startsWith("data:") 
                    ? image_base64 
                    : `data:image/jpeg;base64,${image_base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON response from AI
    let result: OCRResponse;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      result = {
        montant: null,
        date: null,
        categorie: null,
        description: null,
        raw_text: content,
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("OCR error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
