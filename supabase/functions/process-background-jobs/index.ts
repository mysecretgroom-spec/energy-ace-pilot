import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { visitorGuard } from "../_shared/visitorGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function sendPushNotification(userId: string, title: string, message: string, data?: Record<string, string>) {
  const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
  const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
  
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) return;

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        headings: { en: title, fr: title },
        contents: { en: message, fr: message },
        data,
      }),
    });
  } catch (e) {
    console.error("Push notification error:", e);
  }
}

async function processDocumentAnalysis(payload: any, supabase: any) {
  const { documentUrl, documentId, documentName, clientId } = payload;

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Skip AI vision for non-image files (PDF, etc.) — model only supports PNG, JPEG, WebP, GIF
  const urlLower = (documentUrl || "").toLowerCase().split("?")[0];
  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(urlLower) || 
                  (documentUrl || "").startsWith("data:image/");
  if (!isImage) {
    console.log(`[DocAnalysis] Skipping non-image document: ${documentName}`);
    // Just mark as processed without AI classification
    if (documentId) {
      await supabase
        .from("documents")
        .update({
          metadata: {
            ai_extracted: false,
            skip_reason: "non_image_format",
            extraction_date: new Date().toISOString(),
          }
        })
        .eq("id", documentId);
    }
    return { document_type: "autre", confidence: 0, skipped: true, reason: "non_image_format" };
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant spécialisé dans l'analyse de documents administratifs français.
Analyse le document et extrait les informations suivantes si disponibles:
- Type de document (CNI, RIB, facture, justificatif domicile, etc.)
- Informations personnelles (nom, prénom, adresse, date de naissance)
- Numéros importants (IBAN, numéro de compte, PDL, etc.)
- Montants financiers
- Dates importantes

Retourne un JSON structuré avec les champs trouvés.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyse ce document: ${documentName}` },
            { type: "image_url", image_url: { url: documentUrl } }
          ]
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_document_info",
          description: "Extrait les informations structurées du document",
          parameters: {
            type: "object",
            properties: {
              document_type: { type: "string", enum: ["cni", "rib", "facture_energie", "justificatif_domicile", "avis_impots", "taxe_fonciere", "fiche_paie", "autre"] },
              detected_type_label: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              extracted_data: {
                type: "object",
                properties: {
                  nom: { type: "string" },
                  prenom: { type: "string" },
                  adresse: { type: "string" },
                  code_postal: { type: "string" },
                  ville: { type: "string" },
                  date_naissance: { type: "string" },
                  iban: { type: "string" },
                  pdl: { type: "string" },
                  montant_ht: { type: "number" },
                  montant_ttc: { type: "number" },
                  tva: { type: "number" },
                  fournisseur: { type: "string" },
                  date_document: { type: "string" },
                  consommation_kwh: { type: "number" }
                }
              }
            },
            required: ["document_type", "confidence"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "extract_document_info" } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI analysis failed: ${errorText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("No extraction result from AI");
  }

  const extractedInfo = JSON.parse(toolCall.function.arguments);

  // Update document with extracted info
  if (documentId) {
    await supabase
      .from("documents")
      .update({
        type_document: extractedInfo.document_type,
        metadata: {
          ai_extracted: true,
          extraction_date: new Date().toISOString(),
          confidence: extractedInfo.confidence,
          ...extractedInfo.extracted_data
        }
      })
      .eq("id", documentId);
  }

  return extractedInfo;
}

async function processReceiptOcr(payload: any, supabase: any) {
  const { imageUrl, fraisId } = payload;

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en extraction de données de tickets de caisse et factures.
Analyse l'image et extrait:
- Montant total TTC
- Montant HT si visible
- TVA
- Fournisseur/Commerce
- Date
- Catégorie (carburant, péage, repas, hôtel, parking, autre)

Retourne uniquement les données trouvées avec certitude.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse ce justificatif de frais" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_receipt",
          description: "Extrait les données du ticket/facture",
          parameters: {
            type: "object",
            properties: {
              montant_ttc: { type: "number" },
              montant_ht: { type: "number" },
              tva: { type: "number" },
              fournisseur: { type: "string" },
              date: { type: "string" },
              categorie: { type: "string", enum: ["carburant", "peage", "repas", "hotel", "parking", "autre"] },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["montant_ttc", "categorie", "confidence"]
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "extract_receipt" } }
    }),
  });

  if (!response.ok) {
    throw new Error("AI OCR failed");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    throw new Error("No OCR result");
  }

  const ocrData = JSON.parse(toolCall.function.arguments);

  // Update frais if ID provided
  if (fraisId) {
    await supabase
      .from("frais")
      .update({
        montant: ocrData.montant_ttc,
        categorie: ocrData.categorie,
        description: ocrData.fournisseur,
        date_frais: (() => { const d = ocrData.date || new Date().toISOString().split('T')[0]; const today = new Date().toISOString().split('T')[0]; return d > today ? today : d; })(),
        ocr_data: ocrData
      })
      .eq("id", fraisId);
  }

  return ocrData;
}

async function processGeocodeRdv(payload: any, supabase: any) {
  const { rdvId, address, city, postalCode } = payload;

  if (!rdvId || !address) {
    throw new Error("Missing rdvId or address");
  }

  console.log(`[Geocode Job] Processing RDV ${rdvId}: ${address}`);

  // Call the geocode-address edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode-address`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address, city, postal_code: postalCode }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Geocode failed: ${errorText}`);
  }

  const geocodeResult = await response.json();

  if (!geocodeResult.latitude || !geocodeResult.longitude) {
    throw new Error("No coordinates returned");
  }

  // Update the RDV with coordinates
  const { error: updateError } = await supabase
    .from("rdv")
    .update({
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
    })
    .eq("id", rdvId);

  if (updateError) {
    throw new Error(`Update failed: ${updateError.message}`);
  }

  console.log(`[Geocode Job] ✓ RDV ${rdvId} updated: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);

  return {
    rdvId,
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
    approximate: geocodeResult.approximate,
    corrected: geocodeResult.corrected,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  { const __visitor = visitorGuard(req, corsHeaders); if (__visitor) return __visitor; }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending jobs (oldest first, highest priority first)
    const { data: jobs, error: fetchError } = await supabase
      .from("background_jobs")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 3)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) throw fetchError;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const job of jobs) {
      // Mark as processing
      await supabase
        .from("background_jobs")
        .update({ 
          status: "processing", 
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1
        })
        .eq("id", job.id);

      try {
        let result;

        switch (job.job_type) {
          case "document_analysis":
            result = await processDocumentAnalysis(job.payload, supabase);
            break;
          case "ai_classify_document": {
            // Normalize payload keys (documentId or document_id)
            const docId = job.payload.documentId || job.payload.document_id;
            const docUrl = job.payload.url;
            
            if (docId && docUrl) {
              // Fetch document name for better AI context
              const { data: doc } = await supabase
                .from("documents")
                .select("nom")
                .eq("id", docId)
                .single();
              
              result = await processDocumentAnalysis(
                { documentId: docId, documentUrl: docUrl, documentName: doc?.nom || "Document" },
                supabase
              );
            } else if (docId) {
              // No URL provided, fetch from DB
              const { data: doc } = await supabase
                .from("documents")
                .select("nom, url")
                .eq("id", docId)
                .single();
              
              if (doc) {
                // Generate signed URL if it's a storage path
                let resolvedUrl = doc.url;
                if (doc.url && !doc.url.startsWith("http")) {
                  const { data: signed } = await supabase.storage
                    .from("documents")
                    .createSignedUrl(doc.url, 300);
                  if (signed?.signedUrl) resolvedUrl = signed.signedUrl;
                }
                result = await processDocumentAnalysis(
                  { documentId: docId, documentUrl: resolvedUrl, documentName: doc.nom || "Document" },
                  supabase
                );
              } else {
                throw new Error("Document not found");
              }
            } else {
              throw new Error("Missing documentId in payload");
            }
            break;
          }
          case "receipt_ocr":
            result = await processReceiptOcr(job.payload, supabase);
            break;
          case "geocode_rdv":
            result = await processGeocodeRdv(job.payload, supabase);
            break;
          default:
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Mark as completed
        await supabase
          .from("background_jobs")
          .update({ 
            status: "completed", 
            result,
            completed_at: new Date().toISOString()
          })
          .eq("id", job.id);

        // Send push notification
        await sendPushNotification(
          job.user_id,
          "Analyse terminée ✓",
          job.job_type === "document_analysis" 
            ? `Document analysé avec succès` 
            : `Justificatif traité: ${result.montant_ttc}€`,
          { jobId: job.id, type: job.job_type }
        );

        results.push({ jobId: job.id, status: "completed", result });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`Job ${job.id} failed:`, errorMessage);
        
        const isFinalAttempt = job.attempts + 1 >= job.max_attempts;
        
        await supabase
          .from("background_jobs")
          .update({ 
            status: isFinalAttempt ? "failed" : "pending",
            error_message: errorMessage,
            completed_at: isFinalAttempt ? new Date().toISOString() : null
          })
          .eq("id", job.id);

        if (isFinalAttempt) {
          await sendPushNotification(
            job.user_id,
            "Échec de l'analyse",
            "L'analyse du document a échoué après plusieurs tentatives",
            { jobId: job.id, type: job.job_type }
          );
        }

        results.push({ jobId: job.id, status: "failed", error: errorMessage });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Background job processor error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
