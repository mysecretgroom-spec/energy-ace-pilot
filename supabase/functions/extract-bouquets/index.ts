import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    
    if (!imageBase64) {
      throw new Error("Image base64 requise");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY non configurée");
    }

    console.log("Extraction bouquets depuis image, type:", mimeType);

    const systemPrompt = `Tu es un expert en extraction de données tarifaires pour installations solaires photovoltaïques.
    
Tu vas recevoir une image (PDF ou photo) d'une grille tarifaire d'une régie/fournisseur.

EXTRAIT toutes les informations de bouquets/forfaits avec leurs prix et commissions.

Pour chaque ligne/bouquet trouvé, extrait:
- nom_bouquet: le nom du forfait/bouquet (ex: "Essentiel 3kWc", "Premium 6kWc")
- puissance_kwc: la puissance en kWc (nombre décimal)
- prix_recommande: le prix de vente recommandé TTC (nombre)
- prix_max: le prix maximum autorisé TTC (si présent, sinon = prix_recommande * 1.1)
- prix_hejja: le prix plancher/minimum (si présent, sinon = prix_recommande * 0.95)
- commission_fixe: la commission fixe en euros (nombre)
- commission_pct: le pourcentage de commission (si présent, sinon 0)
- description: description optionnelle du contenu du bouquet

IMPORTANT:
- Si certains champs ne sont pas visibles, fais une estimation logique
- Les prix sont généralement en TTC
- Retourne un tableau JSON même s'il n'y a qu'un seul bouquet
- Si tu ne peux pas extraire de données, retourne un tableau vide []`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyse cette grille tarifaire et extrait tous les bouquets/forfaits avec leurs prix et commissions. Retourne uniquement un tableau JSON valide."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_bouquets",
              description: "Extrait les bouquets/forfaits d'une grille tarifaire",
              parameters: {
                type: "object",
                properties: {
                  bouquets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nom_bouquet: { type: "string", description: "Nom du bouquet/forfait" },
                        puissance_kwc: { type: "number", description: "Puissance en kWc" },
                        prix_recommande: { type: "number", description: "Prix recommandé TTC" },
                        prix_max: { type: "number", description: "Prix maximum TTC" },
                        prix_hejja: { type: "number", description: "Prix plancher" },
                        commission_fixe: { type: "number", description: "Commission fixe en euros" },
                        commission_pct: { type: "number", description: "Pourcentage de commission" },
                        description: { type: "string", description: "Description du bouquet" }
                      },
                      required: ["nom_bouquet", "puissance_kwc", "prix_recommande", "commission_fixe"]
                    }
                  }
                },
                required: ["bouquets"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_bouquets" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants, veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erreur AI gateway:", response.status, errorText);
      throw new Error(`Erreur AI: ${response.status}`);
    }

    const data = await response.json();
    console.log("Réponse AI reçue:", JSON.stringify(data, null, 2));

    // Extraire les bouquets depuis la réponse tool call
    let bouquets = [];
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        bouquets = args.bouquets || [];
      } catch (e) {
        console.error("Erreur parsing tool call:", e);
      }
    }

    // Fallback: essayer de parser depuis le content
    if (bouquets.length === 0 && data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          bouquets = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Erreur parsing content JSON:", e);
        }
      }
    }

    // Normaliser les bouquets
    bouquets = bouquets.map((b: any) => ({
      nom_bouquet: b.nom_bouquet || "Bouquet",
      puissance_kwc: Number(b.puissance_kwc) || 3,
      prix_recommande: Number(b.prix_recommande) || 0,
      prix_max: Number(b.prix_max) || Number(b.prix_recommande) * 1.1 || 0,
      prix_hejja: Number(b.prix_hejja) || Number(b.prix_recommande) * 0.95 || 0,
      commission_fixe: Number(b.commission_fixe) || 0,
      commission_pct: Number(b.commission_pct) || 0,
      description: b.description || null,
    }));

    console.log("Bouquets extraits:", bouquets.length);

    return new Response(
      JSON.stringify({ bouquets, count: bouquets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur extraction bouquets:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
