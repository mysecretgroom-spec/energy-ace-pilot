import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Intent types
type Intent = 
  | "create_rdv" 
  | "update_rdv" 
  | "update_vente_status" 
  | "import_document" 
  | "import_facture" 
  | "query_info" 
  | "conversation"
  | "unknown";

interface AgentRequest {
  messageId: string;
  userId: string;
  userName: string;
  fromNumber: string;
  messageType: "text" | "image" | "audio" | "document";
  content: string;
  mediaUrl?: string;
  mediaContentType?: string;
}

interface AgentResponse {
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  actionTaken?: string;
  entityId?: string;
  entityType?: string;
  responseMessage: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: AgentRequest = await req.json();
    console.log("Processing agent request:", request);

    let processedContent = request.content;

    // Handle audio transcription
    if (request.messageType === "audio" && request.mediaUrl) {
      console.log("Transcribing audio message...");
      processedContent = await transcribeAudio(request.mediaUrl, LOVABLE_API_KEY);
      console.log("Transcribed content:", processedContent);
    }

    // Handle image/document analysis
    if ((request.messageType === "image" || request.messageType === "document") && request.mediaUrl) {
      console.log("Analyzing media...");
      const mediaAnalysis = await analyzeMedia(
        request.mediaUrl, 
        request.mediaContentType || "",
        LOVABLE_API_KEY
      );
      processedContent = request.content 
        ? `${request.content}\n\n[Analyse du document: ${mediaAnalysis}]`
        : mediaAnalysis;
    }

    // Get conversation context
    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("context, pending_action")
      .eq("user_id", request.userId)
      .single();

    const conversationContext = (conversation?.context || []) as Array<{ role: string; content: string }>;
    const pendingAction = conversation?.pending_action;

    // Analyze intent with AI
    const aiResponse = await analyzeIntent(
      processedContent,
      request.userName,
      conversationContext,
      pendingAction,
      LOVABLE_API_KEY
    );

    console.log("AI analysis result:", aiResponse);

    // Execute action based on intent
    let actionResult: { actionTaken?: string; entityId?: string; entityType?: string } = {};

    if (aiResponse.intent !== "unknown" && aiResponse.intent !== "conversation" && aiResponse.confidence >= 70) {
      actionResult = await executeAction(
        supabase,
        request.userId,
        aiResponse.intent,
        aiResponse.entities
      );
    }

    // Update conversation context (keep last 5 messages)
    const newContext = [
      ...conversationContext.slice(-4),
      {
        role: "user",
        content: processedContent,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: aiResponse.responseMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    await supabase
      .from("whatsapp_conversations")
      .upsert({
        user_id: request.userId,
        phone_number: request.fromNumber,
        context: newContext,
        pending_action: aiResponse.requiresConfirmation ? aiResponse : null,
        last_message_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    const response: AgentResponse = {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      entities: aiResponse.entities,
      actionTaken: actionResult.actionTaken,
      entityId: actionResult.entityId,
      entityType: actionResult.entityType,
      responseMessage: aiResponse.responseMessage,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        responseMessage: "Une erreur s'est produite. Veuillez réessayer.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Transcribe audio using Gemini
async function transcribeAudio(mediaUrl: string, apiKey: string): Promise<string> {
  // For now, we'll use a text-based approach since direct audio isn't supported
  // In production, you'd download the audio and send it appropriately
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant qui aide à transcrire et comprendre les messages vocaux. Si tu ne peux pas transcrire, indique que le message vocal a été reçu et demande à l'utilisateur de le reformuler en texte."
        },
        {
          role: "user",
          content: `Un message vocal a été envoyé depuis WhatsApp (URL: ${mediaUrl}). Comme je ne peux pas directement transcrire l'audio, génère une réponse appropriée demandant à l'utilisateur de reformuler en texte.`
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to process audio");
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "Message vocal reçu mais non transcrit.";
}

// Analyze media (images/documents)
async function analyzeMedia(
  mediaUrl: string, 
  contentType: string,
  apiKey: string
): Promise<string> {
  // Download media from Twilio (requires auth)
  // For now, return a placeholder - in production you'd download and analyze
  const isImage = contentType.startsWith("image/");
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: isImage 
            ? "Tu analyses des images envoyées par des commerciaux. Décris ce que tu vois et extrait les informations utiles (montants, dates, noms de clients, etc.)."
            : "Tu analyses des documents (PDF, etc.) envoyés par des commerciaux. Extrait les informations clés."
        },
        {
          role: "user",
          content: `Un ${isImage ? "image" : "document"} a été envoyé (type: ${contentType}, URL: ${mediaUrl}). Indique que le document a été reçu et sera traité.`
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze media");
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "Document reçu.";
}

// Analyze intent with AI
async function analyzeIntent(
  content: string,
  userName: string,
  conversationContext: Array<{ role: string; content: string }>,
  pendingAction: unknown,
  apiKey: string
): Promise<{
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  requiresConfirmation: boolean;
  responseMessage: string;
}> {
  const systemPrompt = `Tu es l'assistant WhatsApp intelligent de DébalePro, une application pour commerciaux en énergie renouvelable (panneaux solaires).

Ton rôle est d'analyser les messages des commerciaux et d'identifier leurs intentions pour effectuer des actions automatiques.

INTENTIONS POSSIBLES:
- create_rdv: Créer un nouveau rendez-vous (mots-clés: "rdv", "rendez-vous", "demain", "lundi", heure, adresse)
- update_rdv: Modifier un RDV existant (mots-clés: "décale", "reporte", "annule le rdv")
- update_vente_status: Mettre à jour le statut d'une vente/RDV (mots-clés: "positif", "négatif", "signé", "absent", "r2", "a rappeler")
- import_document: Importer un document client (CNI, RIB, facture énergie...)
- import_facture: Importer une note de frais/ticket
- query_info: Demander des informations (planning, stats, clients)
- conversation: Simple conversation/salutation
- unknown: Intention non comprise

STATUTS DE VENTE À RECONNAÎTRE:
- "positif" / "signé" / "vente" → statut: positif
- "négatif" / "annulé" / "perdu" → statut: negatif
- "r2" / "rappel" / "a rappeler" → statut: a_rappeler
- "reporté" / "décalé" → statut: reporte
- "absent" / "pas la" / "pas là" → statut: absent

Tu dois retourner un JSON avec:
{
  "intent": "...",
  "confidence": 0-100,
  "entities": {
    "client_name": "...",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "address": "...",
    "status": "...",
    "amount": number,
    "document_type": "..."
  },
  "requiresConfirmation": true/false,
  "responseMessage": "Message de confirmation en français, amical et professionnel"
}

Le responseMessage doit:
- Être en français
- Confirmer l'action effectuée ou demander des précisions
- Utiliser des emojis de manière modérée
- Être concis (2-3 lignes max)

Contexte utilisateur: ${userName}
${pendingAction ? `Action en attente de confirmation: ${JSON.stringify(pendingAction)}` : ""}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationContext.slice(-4).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    { role: "user", content }
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_intent",
            description: "Analyze the user's intent and extract entities",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["create_rdv", "update_rdv", "update_vente_status", "import_document", "import_facture", "query_info", "conversation", "unknown"]
                },
                confidence: { type: "number", minimum: 0, maximum: 100 },
                entities: {
                  type: "object",
                  properties: {
                    client_name: { type: "string" },
                    date: { type: "string" },
                    time: { type: "string" },
                    address: { type: "string" },
                    status: { type: "string" },
                    amount: { type: "number" },
                    document_type: { type: "string" }
                  }
                },
                requiresConfirmation: { type: "boolean" },
                responseMessage: { type: "string" }
              },
              required: ["intent", "confidence", "entities", "requiresConfirmation", "responseMessage"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "analyze_intent" } }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("AI API error:", error);
    throw new Error("Failed to analyze intent");
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }

  // Fallback response
  return {
    intent: "unknown",
    confidence: 0,
    entities: {},
    requiresConfirmation: false,
    responseMessage: "Je n'ai pas compris votre demande. Pouvez-vous reformuler ? 🤔"
  };
}

// Execute action based on intent
// deno-lint-ignore no-explicit-any
async function executeAction(
  supabase: any,
  userId: string,
  intent: Intent,
  entities: Record<string, unknown>
): Promise<{ actionTaken?: string; entityId?: string; entityType?: string }> {
  console.log(`Executing action: ${intent}`, entities);

  switch (intent) {
    case "create_rdv": {
      // Search for client by name
      const clientName = entities.client_name as string;
      if (!clientName) {
        return { actionTaken: "missing_client" };
      }

      const { data: clients, error: clientError } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .eq("user_id", userId)
        .or(`nom.ilike.%${clientName}%,prenom.ilike.%${clientName}%`)
        .limit(1);

      if (clientError || !clients || clients.length === 0) {
        return { actionTaken: "client_not_found" };
      }

      const client = clients[0];
      
      // Parse date and time
      const dateStr = entities.date as string || new Date().toISOString().split("T")[0];
      const timeStr = entities.time as string || "10:00";
      const dateHeure = `${dateStr}T${timeStr}:00`;

      // Create RDV
      const { data: rdv, error: rdvError } = await supabase
        .from("rdv")
        .insert({
          user_id: userId,
          client_id: client.id,
          date_heure: dateHeure,
          adresse: entities.address as string || null,
          status: "planifie",
          type_rdv: "R1",
          type_projet: "pv",
          source: "whatsapp",
        })
        .select("id")
        .single();

      if (rdvError) {
        console.error("Error creating RDV:", rdvError);
        return { actionTaken: "error" };
      }

      return { 
        actionTaken: "rdv_created", 
        entityId: rdv?.id, 
        entityType: "rdv" 
      };
    }

    case "update_vente_status": {
      const clientName = entities.client_name as string;
      const status = entities.status as string;

      if (!clientName || !status) {
        return { actionTaken: "missing_data" };
      }

      // Find the most recent RDV for this client
      const { data: rdvs, error: rdvError } = await supabase
        .from("rdv")
        .select(`
          id,
          client_id,
          clients!inner(nom, prenom)
        `)
        .eq("user_id", userId)
        .or(`clients.nom.ilike.%${clientName}%,clients.prenom.ilike.%${clientName}%`)
        .order("date_heure", { ascending: false })
        .limit(1);

      if (rdvError || !rdvs || rdvs.length === 0) {
        return { actionTaken: "rdv_not_found" };
      }

      const rdv = rdvs[0];

      // Map status to enum value
      const statusMap: Record<string, string> = {
        positif: "positif",
        negatif: "negatif",
        absent: "absent",
        reporte: "reporte",
        a_rappeler: "a_rappeler",
      };

      const mappedStatus = statusMap[status] || status;

      // Update RDV status
      const { error: updateError } = await supabase
        .from("rdv")
        .update({ status: mappedStatus })
        .eq("id", rdv.id);

      if (updateError) {
        console.error("Error updating RDV:", updateError);
        return { actionTaken: "error" };
      }

      return { 
        actionTaken: "status_updated", 
        entityId: rdv.id, 
        entityType: "rdv" 
      };
    }

    case "import_document":
    case "import_facture": {
      // These would require actual file handling
      // For now, just acknowledge
      return { 
        actionTaken: "document_received", 
        entityType: intent === "import_facture" ? "frais" : "document" 
      };
    }

    default:
      return {};
  }
}
