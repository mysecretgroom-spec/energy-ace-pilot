import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClassifyRequest {
  image_base64: string; // data URL or raw base64
  mime_type?: string;
}

interface ClassifyResult {
  success: boolean;
  intent: "rdv" | "finance" | "other";
  confidence: number; // 0..1
  reason: string | null;
  error?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Tu es un classifieur d'images pour un CRM commercial photovoltaïque.
Tu reçois UNE image et tu dois identifier sa NATURE en lisant son contenu visuel et textuel.

Catégories possibles:
- "rdv" : capture d'écran d'un CRM, calendrier, email, SMS, note ou fiche contenant un RENDEZ-VOUS client (nom + date/heure ou adresse). Exemples: fiche client d'une autre régie, capture de Google Agenda, email de prise de RDV, SMS d'un confirmateur.
- "finance" : ticket de caisse, facture, reçu, note de frais (carburant, péage, restaurant, hôtel, parking…). Présence typique: montant TTC, TVA, fournisseur commerçant.
- "other" : tout le reste (photo de chantier, document d'identité, photo perso, screenshot non pertinent…).

Règles:
- Lis VRAIMENT le contenu de l'image avant de décider. Ne te fie pas à des suppositions.
- Si tu vois un nom de client + une date/heure de rendez-vous → "rdv".
- Si tu vois un total à payer + un commerçant → "finance".
- En cas de doute entre rdv et finance, regarde la STRUCTURE: tableau de RDV / fiche client = rdv, ticket avec montants en colonnes = finance.
- confidence: 0.0 à 1.0.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, intent: "other", confidence: 0, reason: null, error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image_base64, mime_type }: ClassifyRequest = await req.json();
    if (!image_base64) {
      return new Response(
        JSON.stringify({ success: false, intent: "other", confidence: 0, reason: null, error: "image_base64 required" }),
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
                intent: { type: "string", enum: ["rdv", "finance", "other"] },
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
        JSON.stringify({ success: false, intent: "other", confidence: 0, reason: null, error: `ai_${response.status}` }),
        { status: response.status === 429 || response.status === 402 ? response.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ success: false, intent: "other", confidence: 0, reason: null, error: "no_tool_call" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const result: ClassifyResult = {
      success: true,
      intent: (parsed.intent === "rdv" || parsed.intent === "finance") ? parsed.intent : "other",
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
      JSON.stringify({ success: false, intent: "other", confidence: 0, reason: null, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
