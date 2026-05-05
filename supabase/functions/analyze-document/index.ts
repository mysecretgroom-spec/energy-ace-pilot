import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checkUsageBudget, logUsage, resolveUserId, HARD_CAP_MESSAGE } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  image_base64: string;
  context: "finance" | "client_docs";
}

interface FinanceLineItem {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  categorie: string | null;
  description: string | null;
}

interface FinanceResult {
  type: "finance";
  success: boolean;
  is_multi_category: boolean;
  items: FinanceLineItem[];
  // Legacy single-item fields for backwards compatibility
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  date_debut: string | null;
  date_fin: string | null;
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

IMPORTANT: 
- Si l'image est floue, illisible, ou n'est pas une facture/ticket, retourne success: false avec une explication.
- Si le ticket contient PLUSIEURS TYPES de dépenses (ex: carburant + sandwich), tu DOIS les séparer dans le champ "items".

Champs à extraire:
- success: true si tu as pu lire et comprendre le document, false sinon
- is_multi_category: true si le ticket contient plusieurs catégories de dépenses différentes
- items: tableau des lignes de dépenses si multi-catégorie, chaque item contient:
  - montant_ttc, montant_ht, tva, taux_tva, categorie, description
- montant_ttc: le montant TOTAL TTC en euros (nombre décimal)
- montant_ht: le montant HT total si visible (nombre décimal ou null)
- tva: le montant de TVA total en euros si visible (nombre ou null)
- taux_tva: le taux de TVA principal en % si visible (ex: 20 pour 20%)
- date: la date au format YYYY-MM-DD
- date_debut: date de début de la période au format YYYY-MM-DD (pour hôtel: check-in, pour location véhicule: début location). null si non applicable.
- date_fin: date de fin de la période au format YYYY-MM-DD (pour hôtel: check-out, pour location véhicule: fin location). null si non applicable.
- fournisseur: le nom du commerce/enseigne
- description: courte description de la dépense principale ou "Achats multiples" si multi-catégorie
- categorie: catégorie principale si mono-catégorie, sinon "autre"
- error_message: si success=false, explique pourquoi

IMPORTANT pour date_debut/date_fin: ces champs sont utiles pour les frais répartis sur plusieurs jours (hôtel, location véhicule). Si la facture indique une période (ex: "du 15/01 au 18/01", "3 nuits", "check-in/check-out"), extrais les dates. Sinon laisse null.

Catégories valides: "carburant", "peage", "repas", "hotel", "parking", "train", "location_vehicule", "autre"

Exemple MONO-CATÉGORIE:
{"success": true, "is_multi_category": false, "items": [], "montant_ttc": 54.60, "montant_ht": 45.50, "tva": 9.10, "taux_tva": 20, "date": "2026-01-21", "date_debut": null, "date_fin": null, "fournisseur": "Total", "description": "Plein essence", "categorie": "carburant"}

Exemple HÔTEL avec période:
{"success": true, "is_multi_category": false, "items": [], "montant_ttc": 240.00, "montant_ht": 200.00, "tva": 40.00, "taux_tva": 20, "date": "2026-01-18", "date_debut": "2026-01-15", "date_fin": "2026-01-18", "fournisseur": "Ibis Budget", "description": "3 nuits", "categorie": "hotel"}

Exemple MULTI-CATÉGORIE (station essence avec sandwich):
{"success": true, "is_multi_category": true, "items": [{"montant_ttc": 45.00, "montant_ht": 37.50, "tva": 7.50, "taux_tva": 20, "categorie": "carburant", "description": "Gazole"}, {"montant_ttc": 8.50, "montant_ht": 8.10, "tva": 0.40, "taux_tva": 5.5, "categorie": "repas", "description": "Sandwich + boisson"}], "montant_ttc": 53.50, "date": "2026-01-21", "date_debut": null, "date_fin": null, "fournisseur": "Total Access", "description": "Achats multiples", "categorie": "autre"}

Exemple échec:
{"success": false, "is_multi_category": false, "items": [], "montant_ttc": null, "montant_ht": null, "tva": null, "taux_tva": null, "date": null, "date_debut": null, "date_fin": null, "fournisseur": null, "description": null, "categorie": null, "error_message": "Image trop floue"}`;
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

    // Timeout protection (20s for flash-lite)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
        max_tokens: 350,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
          is_multi_category: parsed.is_multi_category ?? false,
          items: parsed.items ?? [],
          montant_ttc: parsed.montant_ttc ?? null,
          montant_ht: parsed.montant_ht ?? null,
          tva: parsed.tva ?? null,
          taux_tva: parsed.taux_tva ?? null,
          date: parsed.date ?? null,
          date_debut: parsed.date_debut ?? null,
          date_fin: parsed.date_fin ?? null,
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
          is_multi_category: false,
          items: [],
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
