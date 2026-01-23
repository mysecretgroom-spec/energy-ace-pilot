import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image_base64: string;
  context: "finance" | "client_docs";
}

interface FinanceResult {
  type: "finance";
  success: boolean;
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  fournisseur: string | null;
  description: string | null;
  categorie: string | null;
  error_message?: string;
}

interface ClientDocResult {
  type: "client_docs";
  success: boolean;
  document_type: string | null;
  confidence: number;
  description: string | null;
  error_message?: string;
}

type AnalyzeResult = FinanceResult | ClientDocResult;

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, context }: AnalyzeRequest = await req.json();

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

    const imageUrl = image_base64.startsWith("data:") 
      ? image_base64 
      : `data:image/jpeg;base64,${image_base64}`;

    let prompt: string;

    if (context === "finance") {
      prompt = `Analyse cette image de facture/ticket de caisse et extrais les informations en JSON.

IMPORTANT: Si l'image est floue, illisible, ou n'est pas une facture/ticket, retourne success: false avec une explication.

Champs à extraire:
- success: true si tu as pu lire et comprendre le document, false sinon
- montant_ttc: le montant TOTAL TTC en euros (nombre décimal)
- montant_ht: le montant HT si visible (nombre décimal ou null)
- tva: le montant de TVA en euros si visible (nombre ou null)
- taux_tva: le taux de TVA en % si visible (ex: 20 pour 20%)
- date: la date au format YYYY-MM-DD
- fournisseur: le nom du commerce/enseigne
- description: courte description de la dépense
- categorie: une des catégories: "carburant", "peage", "repas", "hotel", "parking", "autre"
- error_message: si success=false, explique pourquoi

Réponds UNIQUEMENT avec le JSON, sans markdown. Exemple succès:
{"success": true, "montant_ttc": 54.60, "montant_ht": 45.50, "tva": 9.10, "taux_tva": 20, "date": "2026-01-21", "fournisseur": "Total", "description": "Plein essence", "categorie": "carburant"}

Exemple échec:
{"success": false, "montant_ttc": null, "montant_ht": null, "tva": null, "taux_tva": null, "date": null, "fournisseur": null, "description": null, "categorie": null, "error_message": "Image trop floue, impossible de lire le texte"}`;
    } else {
      prompt = `Analyse cette image de document client et détermine son type.

IMPORTANT: Si l'image est floue, illisible, ou si tu n'arrives pas à identifier le type de document, retourne success: false.

Types de documents possibles:
- Photos techniques: "photo_tableau" (tableau électrique), "photo_compteur" (compteur électrique), "photo_toiture" (toit), "photo_chantier" (chantier)
- Identité: "cni_monsieur_recto", "cni_monsieur_verso", "cni_madame_recto", "cni_madame_verso"
- Justificatifs domicile: "justificatif_domicile", "taxe_fonciere", "acte_notarie"
- Financiers: "rib", "avis_impots", "fiche_paie_monsieur", "fiche_paie_madame", "attestation_retraite", "attestation_invalidite", "bilans"
- Projet: "facture_energie", "bon_commande", "devis", "contrat", "plan", "assurance"
- Autre: "autre"

Retourne un JSON avec:
- success: true si tu as pu identifier le document, false sinon
- document_type: le type de document parmi la liste ci-dessus
- confidence: niveau de confiance de 0 à 100
- description: courte description de ce que tu vois
- error_message: si success=false, explique pourquoi

Réponds UNIQUEMENT avec le JSON, sans markdown. Exemple:
{"success": true, "document_type": "photo_compteur", "confidence": 95, "description": "Photo d'un compteur Linky"}

Exemple échec:
{"success": false, "document_type": null, "confidence": 0, "description": null, "error_message": "Image floue, impossible d'identifier le document"}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    let result: AnalyzeResult;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleanContent);
      
      if (context === "finance") {
        result = {
          type: "finance",
          success: parsed.success ?? false,
          montant_ttc: parsed.montant_ttc ?? null,
          montant_ht: parsed.montant_ht ?? null,
          tva: parsed.tva ?? null,
          taux_tva: parsed.taux_tva ?? null,
          date: parsed.date ?? null,
          fournisseur: parsed.fournisseur ?? null,
          description: parsed.description ?? null,
          categorie: parsed.categorie ?? null,
          error_message: parsed.error_message,
        };
      } else {
        result = {
          type: "client_docs",
          success: parsed.success ?? false,
          document_type: parsed.document_type ?? null,
          confidence: parsed.confidence ?? 0,
          description: parsed.description ?? null,
          error_message: parsed.error_message,
        };
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      if (context === "finance") {
        result = {
          type: "finance",
          success: false,
          montant_ttc: null,
          montant_ht: null,
          tva: null,
          taux_tva: null,
          date: null,
          fournisseur: null,
          description: null,
          categorie: null,
          error_message: "Impossible de traiter la réponse de l'IA",
        };
      } else {
        result = {
          type: "client_docs",
          success: false,
          document_type: null,
          confidence: 0,
          description: null,
          error_message: "Impossible de traiter la réponse de l'IA",
        };
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Analyze document error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
