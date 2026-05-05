import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkUsageBudget, logUsage, resolveUserId, HARD_CAP_MESSAGE } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { image_base64, document_id, user_id, context } = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Budget check
    const resolvedUserId = await resolveUserId(req, user_id);
    const budget = await checkUsageBudget(resolvedUserId, "smart-analyze");
    if (budget.blocked) {
      return new Response(JSON.stringify({ success: false, error_message: HARD_CAP_MESSAGE, budget_exceeded: true }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = image_base64.startsWith("data:") ? image_base64 : `data:image/jpeg;base64,${image_base64}`;

    // Combined prompt: OCR + Classification + Field extraction
    const prompt = `Tu es un expert en analyse documentaire. Analyse cette image de document et retourne un JSON avec TOUTES ces informations:

1. CLASSIFICATION: Identifie le type de document parmi:
   Photos: "photo_tableau", "photo_compteur", "photo_toiture", "photo_chantier"
   Identité: "cni_monsieur_recto", "cni_monsieur_verso", "cni_madame_recto", "cni_madame_verso"
   Domicile: "justificatif_domicile", "taxe_fonciere", "acte_notarie"
   Financier: "rib", "avis_impots", "fiche_paie_monsieur", "fiche_paie_madame", "attestation_retraite", "attestation_invalidite", "bilans"
   Projet: "facture_energie", "bon_commande", "devis", "contrat", "plan", "assurance"
   Finance: "facture_frais"
   Autre: "autre"

2. EXTRACTION DE TEXTE: Extrais TOUT le texte visible lisible.

3. CHAMPS STRUCTURÉS: Extrais les champs identifiables:
   - nom, prenom (du client/titulaire)
   - adresse, code_postal, ville
   - telephone, email
   - montant, montant_ht, tva
   - date_document (format YYYY-MM-DD)
   - numero_contrat, numero_client, numero_compte
   - iban, bic (si RIB)
   - fournisseur, organisme
   - revenus (si avis d'impôts ou fiche de paie)

4. QUALITÉ: Évalue la qualité du scan (1-100).

Retourne UNIQUEMENT un JSON (pas de markdown):
{
  "success": true,
  "document_type": "...",
  "classification_confidence": 95,
  "description": "courte description",
  "extracted_text": "tout le texte visible...",
  "ocr_quality": 85,
  "fields": {
    "nom": "...",
    "prenom": "...",
    "adresse": "...",
    "code_postal": "...",
    "ville": "...",
    "telephone": "...",
    "email": "...",
    "montant": null,
    "date_document": "...",
    "numero_contrat": "...",
    "fournisseur": "...",
    "iban": null,
    "revenus": null
  },
  "suggested_name": "un nom descriptif pour ce document"
}

Si l'image est illisible: {"success": false, "error_message": "raison", "ocr_quality": 10}`;

    // Use AbortController for timeout protection (25s max)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const chosenModel = budget.forceModel ?? "google/gemini-2.5-flash";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI failed: ${response.status}`);
    }

    const data = await response.json();
    logUsage({ userId: resolvedUserId, functionName: "smart-analyze", model: chosenModel, usage: data.usage });
    const content = data.choices?.[0]?.message?.content || "";
    
    // Tolerant JSON extraction: strip markdown fences, find largest {...} block
    let jsonStr = content.trim();
    // Remove markdown code fences if present
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    // Find first { and last } to extract JSON block even with surrounding text
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error("No JSON braces found in AI response:", content.slice(0, 500));
      return new Response(JSON.stringify({ success: false, error_message: "Réponse IA sans JSON valide", raw_preview: content.slice(0, 200) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content:", content.slice(0, 500));
      return new Response(JSON.stringify({ 
        success: false, 
        error_message: "Impossible de traiter la réponse de l'IA (JSON malformé)",
        raw_preview: jsonStr.slice(0, 200)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If document_id provided, update the document record in DB
    if (document_id && user_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const updateData: Record<string, unknown> = {};
      if (parsed.extracted_text) updateData.extracted_text = parsed.extracted_text;
      if (parsed.document_type && parsed.classification_confidence > 70) {
        updateData.type_document = parsed.document_type;
      }
      if (parsed.fields) updateData.ai_extracted_fields = parsed.fields;
      if (parsed.classification_confidence) updateData.ai_classification_confidence = parsed.classification_confidence;
      if (parsed.suggested_name) updateData.nom = parsed.suggested_name;
      if (parsed.ocr_quality) {
        updateData.metadata = {
          ocrConfidence: parsed.ocr_quality,
          ...(parsed.fields?.montant ? { montant: parsed.fields.montant } : {}),
          ...(parsed.fields?.fournisseur ? { fournisseur: parsed.fields.fournisseur } : {}),
        };
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("documents")
          .update(updateData)
          .eq("id", document_id)
          .eq("user_id", user_id);
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-analyze error:", e);
    return new Response(
      JSON.stringify({ success: false, error_message: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
