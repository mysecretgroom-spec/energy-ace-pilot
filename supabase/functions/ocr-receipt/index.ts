import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
  image_base64: string;
}

interface OCRResponse {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  commercant: string | null;
  raw_text?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Mapping of merchant patterns to categories
const merchantCategoryMap: Record<string, string[]> = {
  carburant: [
    "total", "shell", "bp", "esso", "avia", "intermarche", "leclerc", "carrefour", 
    "super u", "auchan", "casino", "station", "petrole", "essence", "gazole", "diesel",
    "engie", "elan", "dyneff", "vito"
  ],
  peage: [
    "sanef", "aprr", "vinci", "cofiroute", "asf", "escota", "area", "autoroute", 
    "peage", "péage", "toll", "a-way"
  ],
  repas: [
    "mcdo", "mcdonald", "burger", "kfc", "subway", "pizza", "resto", "restaurant",
    "brasserie", "cafe", "café", "bistro", "grill", "sushi", "kebab", "snack",
    "boulangerie", "patisserie", "pâtisserie", "traiteur", "buffalo", "hippopotamus",
    "courtepaille", "flunch", "leon", "paul", "starbucks", "quick", "five guys"
  ],
  hotel: [
    "hotel", "hôtel", "ibis", "novotel", "mercure", "accor", "b&b", "premiere classe",
    "campanile", "kyriad", "best western", "radisson", "marriott", "hilton", "holiday inn",
    "formule 1", "f1", "logis", "comfort inn", "airbnb", "booking"
  ],
  parking: [
    "parking", "parc auto", "effia", "indigo", "q-park", "vinci park", "interparking",
    "saemes", "zenpark", "onepark", "parcmetre"
  ]
};

function deduceCategoryFromMerchant(merchantName: string | null): string | null {
  if (!merchantName) return null;
  
  const lowerName = merchantName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(merchantCategoryMap)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

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
- montant_ttc: le montant TOTAL TTC (toutes taxes comprises) en euros (nombre décimal)
- montant_ht: le montant HT (hors taxes) en euros si visible (nombre décimal ou null)
- tva: le montant de la TVA en euros si visible (nombre décimal ou null)
- taux_tva: le taux de TVA en pourcentage si visible (ex: 20 pour 20%, nombre ou null)
- date: la date au format YYYY-MM-DD
- categorie: une des catégories suivantes: "carburant", "peage", "repas", "hotel", "parking", "autre"
- description: une courte description de la dépense
- commercant: le nom du commerce/enseigne

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Exemple:
{"montant_ttc": 54.60, "montant_ht": 45.50, "tva": 9.10, "taux_tva": 20, "date": "2026-01-21", "categorie": "carburant", "description": "Plein essence", "commercant": "Total Access"}

Si tu ne peux pas lire certaines informations, mets null pour ces champs. Si le HT n'est pas visible mais que tu as le TTC et le taux TVA, calcule-le.`,
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
      
      // If no category was detected by AI, try to deduce from merchant name
      if (!result.categorie && result.commercant) {
        const deducedCategory = deduceCategoryFromMerchant(result.commercant);
        if (deducedCategory) {
          result.categorie = deducedCategory;
        }
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      result = {
        montant_ttc: null,
        montant_ht: null,
        tva: null,
        taux_tva: null,
        date: null,
        categorie: null,
        description: null,
        commercant: null,
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
