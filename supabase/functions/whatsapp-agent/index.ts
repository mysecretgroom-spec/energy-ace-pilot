import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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

interface MediaDownloadResult {
  data: Uint8Array;
  base64: string;
  contentType: string;
  filename: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const request: AgentRequest = await req.json();
    console.log("Processing agent request:", request);

    let processedContent = request.content;
    let mediaData: MediaDownloadResult | null = null;
    let uploadedDocumentUrl: string | null = null;

    // Download media from Twilio if present
    if (request.mediaUrl && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      console.log("Downloading media from Twilio...");
      mediaData = await downloadTwilioMedia(
        request.mediaUrl,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        request.mediaContentType || ""
      );
      console.log(`Downloaded ${mediaData.contentType}, size: ${mediaData.data.length} bytes`);
    }

    // Handle audio transcription with Gemini
    if (request.messageType === "audio" && mediaData) {
      console.log("Transcribing audio message with Gemini...");
      processedContent = await transcribeAudioWithGemini(mediaData, LOVABLE_API_KEY);
      console.log("Transcribed content:", processedContent);
    }

    // Handle image analysis with Gemini Vision
    if (request.messageType === "image" && mediaData) {
      console.log("Analyzing image with Gemini Vision...");
      const imageAnalysis = await analyzeImageWithGemini(mediaData, LOVABLE_API_KEY);
      processedContent = request.content 
        ? `${request.content}\n\n[Analyse de l'image: ${imageAnalysis}]`
        : `[Analyse de l'image: ${imageAnalysis}]`;
      console.log("Image analysis:", imageAnalysis);
    }

    // Handle document (PDF) analysis with Gemini
    if (request.messageType === "document" && mediaData) {
      console.log("Analyzing document with Gemini...");
      const documentAnalysis = await analyzeDocumentWithGemini(mediaData, LOVABLE_API_KEY);
      processedContent = request.content 
        ? `${request.content}\n\n[Analyse du document: ${documentAnalysis}]`
        : `[Analyse du document: ${documentAnalysis}]`;
      console.log("Document analysis:", documentAnalysis);
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
      // For import intents, we need to upload the media first
      if ((aiResponse.intent === "import_document" || aiResponse.intent === "import_facture") && mediaData) {
        console.log("Uploading media to storage...");
        uploadedDocumentUrl = await uploadMediaToStorage(
          supabase,
          mediaData,
          request.userId,
          aiResponse.intent === "import_facture" ? "frais" : "documents"
        );
        console.log("Uploaded to:", uploadedDocumentUrl);
      }

      actionResult = await executeAction(
        supabase,
        request.userId,
        aiResponse.intent,
        aiResponse.entities,
        uploadedDocumentUrl,
        mediaData
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

// Download media from Twilio (requires basic auth)
async function downloadTwilioMedia(
  mediaUrl: string,
  accountSid: string,
  authToken: string,
  contentType: string
): Promise<MediaDownloadResult> {
  const response = await fetch(mediaUrl, {
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  const base64 = encodeBase64(data);
  const actualContentType = response.headers.get("content-type") || contentType;
  
  // Generate filename based on content type
  const ext = getExtensionFromContentType(actualContentType);
  const filename = `whatsapp_${Date.now()}.${ext}`;

  return {
    data,
    base64,
    contentType: actualContentType,
    filename,
  };
}

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/amr": "amr",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[contentType] || "bin";
}

// Transcribe audio using Gemini (supports audio in base64)
async function transcribeAudioWithGemini(
  media: MediaDownloadResult,
  apiKey: string
): Promise<string> {
  // Gemini supports audio via inline_data
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui transcrit des messages vocaux WhatsApp en français.
Transcris fidèlement le contenu audio et identifie les éléments importants :
- Noms de clients mentionnés
- Dates et heures
- Adresses
- Statuts de RDV (positif, négatif, reporté, absent, etc.)
- Montants
- Types de documents

Retourne uniquement la transcription, sans commentaires.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcris ce message vocal WhatsApp :"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${media.contentType};base64,${media.base64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini audio transcription error:", error);
    // Fallback message if transcription fails
    return "[Message vocal reçu - transcription non disponible. Veuillez reformuler en texte.]";
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "[Transcription non disponible]";
}

// Analyze image using Gemini Vision
async function analyzeImageWithGemini(
  media: MediaDownloadResult,
  apiKey: string
): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui analyse des images envoyées par des commerciaux en énergie renouvelable.
Identifie et extrait les informations pertinentes selon le type d'image :

TYPES DE DOCUMENTS CLIENTS :
- Carte d'identité (CNI) : Nom, prénom, date de naissance, numéro
- RIB : IBAN, BIC, titulaire du compte
- Facture d'énergie : Fournisseur, montant, consommation kWh, PDL
- Avis d'imposition : Revenu fiscal, nombre de parts
- Devis/Contrat : Montant, équipements, puissance kWc

NOTES DE FRAIS :
- Ticket de caisse/restaurant : Montant TTC, TVA si visible, date, fournisseur
- Facture carburant : Montant, litres, date
- Péage/Parking : Montant, date

PHOTOS TECHNIQUES :
- Toiture : État, orientation, ombres, obstacles
- Compteur électrique : Type (Linky, etc.), numéro PDL
- Tableau électrique : Emplacement, place disponible

Retourne les informations extraites de manière structurée.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse cette image et extrait les informations importantes :"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${media.contentType};base64,${media.base64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini vision error:", error);
    return "Image reçue mais analyse non disponible.";
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "Analyse non disponible.";
}

// Analyze PDF document using Gemini
async function analyzeDocumentWithGemini(
  media: MediaDownloadResult,
  apiKey: string
): Promise<string> {
  // For PDFs, we use the same approach - Gemini can handle PDF as base64
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui analyse des documents PDF envoyés par des commerciaux.
Extrait les informations clés du document selon son type :

- Facture d'énergie : Fournisseur, PDL, consommation annuelle, montant
- Avis d'imposition : Revenu fiscal de référence, nombre de parts
- Devis/Contrat : Client, équipements, puissance, montant TTC
- RIB : IBAN, BIC, titulaire
- Document administratif : Type, numéro, informations principales

Retourne les informations de manière structurée et concise.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyse ce document PDF et extrait les informations importantes :"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${media.contentType};base64,${media.base64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini document analysis error:", error);
    return "Document reçu mais analyse non disponible.";
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "Analyse non disponible.";
}

// Upload media to Supabase Storage
// deno-lint-ignore no-explicit-any
async function uploadMediaToStorage(
  supabase: any,
  media: MediaDownloadResult,
  userId: string,
  bucket: string
): Promise<string> {
  const timestamp = Date.now();
  const filePath = `whatsapp/${userId}/${timestamp}_${media.filename}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(bucket === "frais" ? "receipts" : "documents")
    .upload(filePath, media.data, {
      contentType: media.contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Failed to upload: ${uploadError.message}`);
  }

  // Get signed URL (1 year validity)
  const { data: urlData } = await supabase.storage
    .from(bucket === "frais" ? "receipts" : "documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);

  if (!urlData?.signedUrl) {
    throw new Error("Failed to generate signed URL");
  }

  return urlData.signedUrl;
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
- import_document: Importer un document client (CNI, RIB, facture énergie, avis d'imposition) - quand une image/PDF de document client est envoyé
- import_facture: Importer une note de frais/ticket (restaurant, carburant, péage) - quand une photo de ticket/reçu est envoyé
- query_info: Demander des informations (planning, stats, clients)
- conversation: Simple conversation/salutation
- unknown: Intention non comprise

STATUTS DE VENTE À RECONNAÎTRE:
- "positif" / "signé" / "vente" → statut: positif
- "négatif" / "annulé" / "perdu" → statut: negatif
- "r2" / "rappel" / "a rappeler" → statut: a_rappeler
- "reporté" / "décalé" → statut: reporte
- "absent" / "pas la" / "pas là" → statut: absent

TYPES DE DOCUMENTS:
- CNI, carte d'identité → document_type: "cni"
- RIB, relevé bancaire → document_type: "rib"
- Facture énergie, EDF, Engie → document_type: "facture_energie"
- Avis d'imposition → document_type: "avis_imposition"
- Ticket restaurant, repas → document_type: "frais_repas"
- Carburant, essence → document_type: "frais_carburant"
- Péage, autoroute → document_type: "frais_peage"

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
    "document_type": "...",
    "extracted_data": { ... }
  },
  "requiresConfirmation": true/false,
  "responseMessage": "Message de confirmation en français, amical et professionnel"
}

Le responseMessage doit:
- Être en français
- Confirmer l'action effectuée ou demander des précisions
- Utiliser des emojis de manière modérée
- Être concis (2-3 lignes max)
- Pour les documents, confirmer les infos extraites

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
                    document_type: { type: "string" },
                    extracted_data: { type: "object" }
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
  entities: Record<string, unknown>,
  uploadedDocumentUrl: string | null,
  mediaData: MediaDownloadResult | null
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

    case "import_document": {
      if (!uploadedDocumentUrl) {
        return { actionTaken: "no_media" };
      }

      const documentType = entities.document_type as string || "autre";
      const clientName = entities.client_name as string;
      
      // Try to find the client if name was mentioned
      let clientId: string | null = null;
      if (clientName) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", userId)
          .or(`nom.ilike.%${clientName}%,prenom.ilike.%${clientName}%`)
          .limit(1);
        
        if (clients && clients.length > 0) {
          clientId = clients[0].id;
        }
      }

      // If no client found, get the most recent one with active RDV
      if (!clientId) {
        const { data: recentRdv } = await supabase
          .from("rdv")
          .select("client_id")
          .eq("user_id", userId)
          .order("date_heure", { ascending: false })
          .limit(1);
        
        if (recentRdv && recentRdv.length > 0) {
          clientId = recentRdv[0].client_id;
        }
      }

      if (!clientId) {
        return { actionTaken: "no_client_found" };
      }

      // Map document type to enum
      const docTypeMap: Record<string, string> = {
        cni: "cni",
        rib: "rib",
        facture_energie: "facture_energie",
        avis_imposition: "avis_imposition",
        autre: "autre",
      };

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          client_id: clientId,
          nom: `${documentType}_whatsapp_${Date.now()}`,
          type_document: docTypeMap[documentType] || "autre",
          url: uploadedDocumentUrl,
          mime_type: mediaData?.contentType || "application/octet-stream",
          context_source: "whatsapp",
          metadata: entities.extracted_data || {},
        })
        .select("id")
        .single();

      if (docError) {
        console.error("Error creating document:", docError);
        return { actionTaken: "error" };
      }

      return {
        actionTaken: "document_imported",
        entityId: doc?.id,
        entityType: "document",
      };
    }

    case "import_facture": {
      if (!uploadedDocumentUrl) {
        return { actionTaken: "no_media" };
      }

      const fraisType = entities.document_type as string || "autre";
      const amount = entities.amount as number;
      const extractedData = entities.extracted_data as Record<string, unknown> || {};

      // Map to frais category
      const categorieMap: Record<string, string> = {
        frais_repas: "repas",
        frais_carburant: "carburant",
        frais_peage: "peage",
        frais_parking: "parking",
        frais_hotel: "hotel",
        autre: "autre",
      };

      // Create frais record
      const { data: frais, error: fraisError } = await supabase
        .from("frais")
        .insert({
          user_id: userId,
          categorie: categorieMap[fraisType] || "autre",
          montant: amount || (extractedData.amount_ttc as number) || 0,
          date_frais: new Date().toISOString().split("T")[0],
          description: `Import WhatsApp - ${fraisType}`,
          justificatif_url: uploadedDocumentUrl,
          ocr_data: extractedData,
        })
        .select("id")
        .single();

      if (fraisError) {
        console.error("Error creating frais:", fraisError);
        return { actionTaken: "error" };
      }

      return {
        actionTaken: "frais_imported",
        entityId: frais?.id,
        entityType: "frais",
      };
    }

    default:
      return {};
  }
}
