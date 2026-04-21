import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const productCategoriesMap: Record<string, { categories: string; typeCalc: string; hint: string }> = {
  PV: {
    categories: "support (support d'installation: tuile, ardoise, bac acier, sol béton...), emplacement_boitier (où placer onduleur/coffret AC: garage, extérieur, distance...), compteur (type compteur: Linky monophasé, triphasé, changement compteur...)",
    typeCalc: "fixe (forfait), par_panneau (par panneau), par_ml (par mètre linéaire de câble)",
    hint: "Photovoltaïque: panneaux solaires, supports, raccordement compteur",
  },
  PAC: {
    categories: "type_pac (type d'unité: Air-Air, Air-Eau, mono-split, multi-split...), installation (frais pose: percement mur, gaine, pompe relevage condensats...), accessoires (thermostat, ballon ECS supplémentaire, kit hydraulique...)",
    typeCalc: "fixe (forfait), par_ml (par mètre linéaire de liaison frigorifique)",
    hint: "Pompe à chaleur: unités intérieures/extérieures, accessoires, installation",
  },
  ITE: {
    categories: "finition (enduit organique, minéral, brique plaquette, bardage bois...), complexite (échafaudage, hauteur, étages, accessibilité difficile...), accessoires_ite (appuis fenêtre, encadrements, gouttières, volets battants déposés...)",
    typeCalc: "fixe (forfait), par_m2 (par m² de surface), par_ml (par mètre linéaire)",
    hint: "Isolation extérieure: finition, complexité chantier, accessoires",
  },
};

const getSystemPrompt = (productType: string) => {
  const cfg = productCategoriesMap[productType] || productCategoriesMap.PV;
  return `Tu es un expert en extraction de données tarifaires pour les SURCOÛTS techniques d'installations ${productType}.

Tu reçois une image (PDF ou photo) d'une grille tarifaire de surcoûts/options/suppléments d'une régie.

EXTRAIT chaque ligne de surcoût avec:
- categorie: STRICTEMENT l'une de ces valeurs (selon le contexte de la ligne):
  ${cfg.categories}
- code: identifiant court en snake_case (ex: "sol_beton", "bac_acier", "linky_mono", "split_mural", "enduit_organique"). Doit être unique par catégorie.
- nom: libellé affiché lisible (ex: "Sol béton", "Bac acier", "Linky monophasé", "Split mural", "Enduit organique")
- prix: montant en euros (nombre)
- type_calcul: STRICTEMENT l'une de:
  ${cfg.typeCalc}

Indices contextuels: ${cfg.hint}

RÈGLES:
- Ne mélange jamais les surcoûts d'un autre produit
- Si le prix est par panneau/m²/ml, utilise le bon type_calcul
- Si non précisé, utilise "fixe"
- Génère un code unique court et explicite à partir du nom
- Retourne TOUS les surcoûts visibles, pas seulement les premiers
- Si aucun surcoût détecté, retourne un tableau vide`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, productType = "PV" } = await req.json();

    if (!imageBase64) {
      throw new Error("Image base64 requise");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY non configurée");
    }

    console.log("Extraction surcouts, type:", mimeType, "productType:", productType);

    const systemPrompt = getSystemPrompt(productType);

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
                text: `Analyse cette grille de surcoûts ${productType} et extrait toutes les options/suppléments avec leur catégorie, prix et type de calcul.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_surcouts",
              description: `Extrait les surcoûts techniques d'une grille tarifaire ${productType}`,
              parameters: {
                type: "object",
                properties: {
                  surcouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categorie: { type: "string", description: "Catégorie de surcoût" },
                        code: { type: "string", description: "Code unique snake_case" },
                        nom: { type: "string", description: "Libellé affiché" },
                        prix: { type: "number", description: "Montant en euros" },
                        type_calcul: {
                          type: "string",
                          enum: ["fixe", "par_panneau", "par_m2", "par_ml"],
                          description: "Type de calcul du prix",
                        },
                      },
                      required: ["categorie", "code", "nom", "prix", "type_calcul"],
                    },
                  },
                },
                required: ["surcouts"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_surcouts" } },
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
    let surcouts: any[] = [];

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        surcouts = args.surcouts || [];
      } catch (e) {
        console.error("Erreur parsing tool call:", e);
      }
    }

    // Validate categories per product
    const validCategories: Record<string, string[]> = {
      PV: ["support", "emplacement_boitier", "compteur"],
      PAC: ["type_pac", "installation", "accessoires"],
      ITE: ["finition", "complexite", "accessoires_ite"],
    };
    const allowed = validCategories[productType] || [];

    surcouts = surcouts
      .filter((s) => s && s.nom && s.code)
      .map((s: any) => ({
        categorie: allowed.includes(s.categorie) ? s.categorie : allowed[0],
        code: String(s.code).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        nom: String(s.nom).trim(),
        prix: Number(s.prix) || 0,
        type_calcul: ["fixe", "par_panneau", "par_m2", "par_ml"].includes(s.type_calcul)
          ? s.type_calcul
          : "fixe",
      }));

    console.log(`Surcouts ${productType} extraits:`, surcouts.length);

    return new Response(
      JSON.stringify({ surcouts, count: surcouts.length, productType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erreur extraction surcouts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
