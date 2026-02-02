import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKFLOW_SYSTEM_PROMPT = `Tu es un assistant expert en création de workflows d'automatisation IA pour une application de gestion commerciale (CRM, RDV, ventes, documents, frais).

TYPES DE NŒUDS DISPONIBLES:
- trigger: Déclencheur du workflow (nouveau RDV, nouvelle vente, message reçu, document uploadé, etc.)
- action: Action à exécuter (envoyer notification, créer client, mettre à jour statut, analyser document, etc.)
- condition: Branchement conditionnel (si statut = X, si montant > Y, si client existe, etc.)
- fallback: Action de secours si une étape échoue

EXEMPLES DE WORKFLOWS:
1. "Confirmation RDV automatique": trigger(nouveau_rdv) → action(envoyer_whatsapp_confirmation)
2. "Analyse facture": trigger(document_uploadé) → action(ocr_analyse) → condition(montant > 100) → action(créer_frais) / fallback(notifier_erreur)
3. "Suivi vente": trigger(vente_signée) → action(notifier_équipe) → condition(financement_ok) → action(planifier_installation)

RÈGLES:
- Pose des questions pour clarifier les besoins
- Suggère des améliorations et des fallbacks
- Propose une structure claire avec les nœuds et connexions
- Explique la logique de chaque étape

Quand l'utilisateur valide un workflow, génère un JSON avec la structure:
{
  "nodes": [
    { "id": "1", "type": "trigger|action|condition|fallback", "label": "Nom", "config": {} }
  ],
  "edges": [
    { "source": "1", "target": "2", "condition_type": "success|failure|default" }
  ]
}

Réponds en français de manière concise et professionnelle.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentWorkflow } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context with current workflow state if provided
    let contextMessage = "";
    if (currentWorkflow && currentWorkflow.nodes?.length > 0) {
      contextMessage = `\n\nWORKFLOW ACTUEL:\n${JSON.stringify(currentWorkflow, null, 2)}`;
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
          { role: "system", content: WORKFLOW_SYSTEM_PROMPT + contextMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés, veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("workflow-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
