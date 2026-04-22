import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type ImageIntent = "rdv" | "finance" | "photo_etude" | "doc_client" | "autre";

interface ClassifyRequest {
  image_base64: string; // data URL or raw base64
  mime_type?: string;
}

interface ClassifyResult {
  success: boolean;
  intent: ImageIntent;
  confidence: number; // 0..1
  reason: string | null;
  error?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Tu es un classifieur d'images pour un CRM commercial photovoltaïque (énergie solaire, PAC, isolation).
Tu reçois UNE image et tu dois identifier sa NATURE en lisant son contenu visuel et textuel.

Catégories possibles (choisis EXACTEMENT une) :

• "rdv" — Capture d'écran, photo de fiche, email ou note contenant un RENDEZ-VOUS client.
  Exemples : fiche client d'une autre régie, capture Google Agenda, email de prise de RDV,
  SMS d'un confirmateur, fiche papier avec nom + prénom + téléphone + adresse + date/heure.
  Indices : présence d'un nom client + d'une date OU d'une heure OU d'une adresse.

• "finance" — Ticket de caisse, facture, reçu, note de frais.
  Exemples : ticket carburant, péage autoroute, restaurant, hôtel, parking, achat fournitures.
  Indices : montant TTC, TVA, nom de commerçant, total à payer, structure tabulaire de prix.

• "photo_etude" — Photo PRISE PAR LE COMMERCIAL sur le terrain pendant une étude technique.
  Exemples : photo de toiture (tuiles, panneaux, cheminée), photo de compteur électrique
  Linky/EDF, photo de tableau électrique, photo de disjoncteur, photo de façade de maison,
  photo d'un mur extérieur (ITE), photo d'une chaudière, photo d'une PAC existante.
  Indices : photo "brute" en intérieur/extérieur, pas de texte structuré dominant.

• "doc_client" — Document administratif fourni par le client.
  Exemples : carte d'identité (CNI/CNIE), passeport, RIB / IBAN bancaire, justificatif de
  domicile (facture EDF, quittance de loyer), avis d'imposition, taxe foncière,
  attestation MaPrimeRénov', livret de famille.
  Indices : document officiel scanné/photographié, en-tête administratif, IBAN, MRZ
  (carte d'identité), nom + adresse + numéro fiscal.

• "autre" — Tout le reste : photo personnelle, mème, capture illisible, photo floue
  sans contexte exploitable, screenshot d'application non pertinent.

Règles de décision :
- Lis VRAIMENT le contenu de l'image avant de décider.
- En cas de doute entre "rdv" et "finance", regarde la STRUCTURE :
  fiche/tableau de RDV → "rdv" ; ticket avec montants → "finance".
- En cas de doute entre "doc_client" et "finance" : un IBAN, une CNI, un avis d'imposition
  ou un justificatif de domicile sont TOUJOURS "doc_client", PAS "finance".
- En cas de doute entre "photo_etude" et "autre" : si on devine clairement un compteur,
  un tableau électrique, une toiture ou une façade exploitable → "photo_etude".
- Si l'image est trop floue/illisible OU sans rapport avec le métier → "autre".
- confidence : 0.0 (incertain) à 1.0 (certain).
- reason : 1 phrase courte (≤120 caractères).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, intent: "autre", confidence: 0, reason: null, error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image_base64, mime_type }: ClassifyRequest = await req.json();
    if (!image_base64) {
      return new Response(
        JSON.stringify({ success: false, intent: "autre", confidence: 0, reason: null, error: "image_base64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:${mime_type || "image/jpeg"};base64,${image_base64}`;

    const body = {
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Classe cette image." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify_image",
            description: "Retourne la classification de l'image.",
            parameters: {
              type: "object",
              properties: {
                intent: { type: "string", enum: ["rdv", "finance", "photo_etude", "doc_client", "autre"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string", description: "Brève justification (max 120 caractères)." },
              },
              required: ["intent", "confidence", "reason"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify_image" } },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ success: false, intent: "autre", confidence: 0, reason: null, error: `ai_${response.status}` }),
        { status: response.status === 429 || response.status === 402 ? response.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ success: false, intent: "autre", confidence: 0, reason: null, error: "no_tool_call" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const allowed: ImageIntent[] = ["rdv", "finance", "photo_etude", "doc_client", "autre"];
    const intent: ImageIntent = allowed.includes(parsed.intent) ? parsed.intent : "autre";

    const result: ClassifyResult = {
      success: true,
      intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reason: parsed.reason ?? null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-image-intent error:", e);
    return new Response(
      JSON.stringify({ success: false, intent: "autre", confidence: 0, reason: null, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
