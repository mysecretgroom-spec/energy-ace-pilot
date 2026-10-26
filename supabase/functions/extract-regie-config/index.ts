import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visitorGuard } from "../_shared/visitorGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageInput {
  imageBase64: string;
  mimeType?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  { const __visitor = visitorGuard(req, corsHeaders); if (__visitor) return __visitor; }

  try {
    const body = await req.json();
    // Backward compat: accept single image OR an array of images
    const images: ImageInput[] = Array.isArray(body.images) && body.images.length > 0
      ? body.images
      : body.imageBase64
        ? [{ imageBase64: body.imageBase64, mimeType: body.mimeType }]
        : [];

    if (images.length === 0) {
      throw new Error("Au moins une image est requise");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY non configurée");
    }

    console.log(`Extract regie config from ${images.length} image(s)`);

    const systemPrompt = `Tu es un expert en extraction de données tarifaires pour des régies d'installations énergétiques (PV, PAC, ITE).

Tu vas recevoir UN OU PLUSIEURS documents (PDF ou images) contenant les conditions commerciales d'une régie partenaire. Les documents peuvent contenir des informations complémentaires : par exemple un screenshot pour la grille PV, un autre pour PAC, un autre pour les surcoûts, et un dernier pour les financements. Analyse TOUS les documents et fusionne les données extraites.

EXTRAIT les informations suivantes selon ce qui est visible dans les documents:

1. **BOUQUETS/TARIFS** (grilles tarifaires par produit):
   Pour chaque ligne/bouquet, extrait:
   - product_type: "PV", "PAC" ou "ITE"
   - nom_bouquet: nom du forfait
   - puissance_kwc: puissance kWc (PV), kW (PAC) ou m² (ITE)
   - prix_recommande: prix TTC recommandé
   - commission_fixe: commission en euros
   - description: détails optionnels

2. **SURCOÛTS** (options supplémentaires facturées):
   Pour chaque surcoût, extrait:
   - product_type: "PV", "PAC" ou "ITE"
   - categorie: Pour PV: "support"|"emplacement_boitier"|"compteur". Pour PAC: "type_pac"|"installation"|"accessoires". Pour ITE: "finition"|"complexite"|"accessoires_ite"
   - nom: nom affiché (ex: "Pergola", "Triphasé", "Sol béton")
   - code: code technique en snake_case (ex: "pergola", "triphase", "sol_beton")
   - prix: montant en euros (prix UNITAIRE)
   - type_calcul: "fixe"|"par_panneau"|"par_m2"|"par_ml"

   🔑 DÉTECTION CRITIQUE FIXE vs VARIABLE:
   Examine attentivement chaque surcoût pour déterminer si le prix est FIXE (forfait global) ou VARIABLE (multiplié par quantité).
   Indices VARIABLE :
   - "par_panneau" : "/panneau", "par panneau", "/pann", "x N panneaux", "panneau additionnel/supplémentaire"
   - "par_m2" : "/m²", "par m²", "au mètre carré", surface
   - "par_ml" : "/ml", "/mètre linéaire", "ml de câble/liaison/gaine"
   Indices FIXE : "forfait", "kit", prix unique sans référence à une puissance (ex: "Triphasé : 1500€")

   🎯 CAS SPÉCIAL — Surcoût décliné par puissance (kWc/kW) :
   Si le NOM d'un surcoût contient une puissance (ex: "Pergola 3kWc", "Carport 6kW", "Toiture 9kWc"), c'est un surcoût VARIABLE par_panneau dont le prix s'adapte à la taille de l'installation.
   - Si plusieurs lignes du même surcoût existent avec différentes puissances (ex: "Pergola 3kWc : 4500€", "Pergola 6kWc : 9000€"), FUSIONNE-les en UNE SEULE entrée avec type_calcul=par_panneau et un prix UNITAIRE par panneau (1 panneau ≈ 0.5 kWc, donc 3kWc = 6 panneaux).
   - Exemple : "Pergola 3kWc : 4500€" → 6 panneaux → 750€/panneau → { nom: "Pergola", type_calcul: "par_panneau", prix: 750 }
   - Ne crée JAMAIS plusieurs entrées "Pergola 3kWc", "Pergola 6kWc"... une seule entrée "Pergola" suffit.

   Règles complémentaires :
   - Si une colonne ou en-tête mentionne "/panneau" "/m²" "/ml", applique-la à toutes les lignes du tableau.
   - Pour PV : si le prix est < 200€ et le contexte évoque les panneaux → préférer par_panneau.
   - Le prix doit toujours être UNITAIRE (par panneau/m²/ml), pas le total.

3. **FINANCEMENTS** (options de financement proposées):
   Pour chaque option de financement, extrait:
   - nom: nom descriptif (ex: "Cetelem 120 mois", "Comptant")
   - duree_mois: durée en mois (1 pour comptant)
   - taux_effectif: taux effectif en % (0 pour comptant)
   - taeg: TAEG en % (0 pour comptant)

IMPORTANT:
- Extrait UNIQUEMENT ce qui est visible dans les documents
- Les prix sont généralement en TTC
- Si une donnée n'est pas visible, ne l'invente pas
- Évite les doublons si une même ligne apparaît dans plusieurs images
- Retourne des tableaux vides si une catégorie n'est pas présente`;

    const userContent: any[] = [
      {
        type: "text",
        text: `Analyse ${images.length > 1 ? `ces ${images.length} documents` : "ce document"} de conditions commerciales d'une régie et extrait tous les bouquets/tarifs, surcoûts et options de financement. Fusionne les données et retourne-les structurées.`,
      },
      ...images.map((img) => ({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType || "image/jpeg"};base64,${img.imageBase64}`,
        },
      })),
    ];

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_regie_config",
              description: "Extrait la configuration complète d'une régie depuis un ou plusieurs documents",
              parameters: {
                type: "object",
                properties: {
                  bouquets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product_type: { type: "string", enum: ["PV", "PAC", "ITE"] },
                        nom_bouquet: { type: "string" },
                        puissance_kwc: { type: "number" },
                        prix_recommande: { type: "number" },
                        commission_fixe: { type: "number" },
                        description: { type: "string" },
                      },
                      required: ["product_type", "nom_bouquet", "puissance_kwc", "prix_recommande"],
                    },
                  },
                  surcouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product_type: { type: "string", enum: ["PV", "PAC", "ITE"] },
                        categorie: { type: "string" },
                        nom: { type: "string" },
                        code: { type: "string" },
                        prix: { type: "number" },
                        type_calcul: { type: "string", enum: ["fixe", "par_panneau", "par_m2", "par_ml"] },
                      },
                      required: ["product_type", "categorie", "nom", "code", "prix", "type_calcul"],
                    },
                  },
                  financements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nom: { type: "string" },
                        duree_mois: { type: "number" },
                        taux_effectif: { type: "number" },
                        taeg: { type: "number" },
                      },
                      required: ["nom", "duree_mois"],
                    },
                  },
                },
                required: ["bouquets", "surcouts", "financements"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_regie_config" } },
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
          JSON.stringify({ error: "Crédits insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();

    let result = { bouquets: [], surcouts: [], financements: [] } as any;

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }

    if (!result.bouquets?.length && !result.surcouts?.length && !result.financements?.length) {
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Content parse error:", e);
          }
        }
      }
    }

    result.bouquets = (result.bouquets || []).map((b: any) => ({
      product_type: b.product_type || "PV",
      nom_bouquet: b.nom_bouquet || "Bouquet",
      puissance_kwc: Number(b.puissance_kwc) || 0,
      prix_recommande: Number(b.prix_recommande) || 0,
      commission_fixe: Number(b.commission_fixe) || 0,
      description: b.description || null,
    }));

    result.surcouts = (result.surcouts || []).map((s: any) => ({
      product_type: s.product_type || "PV",
      categorie: s.categorie || "support",
      nom: s.nom || "",
      code: (s.code || s.nom || "").toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
      prix: Number(s.prix) || 0,
      type_calcul: s.type_calcul || "fixe",
    }));

    result.financements = (result.financements || []).map((f: any) => ({
      nom: f.nom || "Financement",
      duree_mois: Number(f.duree_mois) || 120,
      taux_effectif: Number(f.taux_effectif) || 0,
      taeg: Number(f.taeg) || 0,
    }));

    console.log(
      `Extracted: ${result.bouquets.length} bouquets, ${result.surcouts.length} surcouts, ${result.financements.length} financements`
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-regie-config error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
