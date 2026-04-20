import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageInput {
  // Base64 data URL ("data:image/jpeg;base64,....") OR raw base64 string
  data: string;
  mime_type?: string;
}

interface ExtractedRdv {
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  date: string | null; // YYYY-MM-DD
  heure: string | null; // HH:mm
  type_projet: string | null; // photovoltaique | pompe_chaleur | isolation | ballon_thermo | autre
  notes: string | null;
  confidence: number; // 0..1
}

const SYSTEM_PROMPT = `Tu es un assistant expert en extraction d'informations de rendez-vous depuis des captures d'écran de CRM, emails, SMS, calendriers ou notes manuscrites.

Ton rôle: analyser une ou plusieurs images et extraire TOUTES les informations utiles pour créer un rendez-vous client dans un CRM photovoltaïque/énergie.

Règles:
- Si plusieurs images sont fournies, elles concernent UN SEUL rendez-vous (vues différentes du même CRM).
- Date au format YYYY-MM-DD. Si tu vois "demain", "lundi prochain", etc., calcule par rapport à la date actuelle (donnée dans le contexte).
- Heure au format HH:mm sur 24h.
- Téléphone: garder le format français (ex: 0612345678 ou +33612345678).
- type_projet doit être l'une de ces valeurs: photovoltaique, pompe_chaleur, isolation, ballon_thermo, autre. Photovoltaïque par défaut si non précisé.
- Si une info n'est pas visible/déductible, mets null. NE JAMAIS inventer.
- confidence: 0.9+ si toutes les infos critiques (nom + date) sont claires, 0.6-0.8 si partiel, <0.5 si très incertain.`;

async function callGeminiVision(images: ImageInput[], todayIso: string, apiKey: string) {
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Date d'aujourd'hui: ${todayIso}. Analyse ${images.length === 1 ? "cette capture d'écran" : `ces ${images.length} captures d'écran`} et extrait les informations du rendez-vous.`,
    },
    ...images.map((img) => {
      const url = img.data.startsWith("data:")
        ? img.data
        : `data:${img.mime_type || "image/jpeg"};base64,${img.data}`;
      return {
        type: "image_url",
        image_url: { url },
      };
    }),
  ];

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "extract_rdv_data",
          description: "Retourne les informations structurées du rendez-vous extraites de l'image.",
          parameters: {
            type: "object",
            properties: {
              nom: { type: ["string", "null"], description: "Nom de famille du client" },
              prenom: { type: ["string", "null"], description: "Prénom du client" },
              telephone: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              adresse: { type: ["string", "null"], description: "Adresse rue + numéro" },
              code_postal: { type: ["string", "null"] },
              ville: { type: ["string", "null"] },
              date: { type: ["string", "null"], description: "YYYY-MM-DD" },
              heure: { type: ["string", "null"], description: "HH:mm 24h" },
              type_projet: {
                type: ["string", "null"],
                enum: ["photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", "autre", null],
              },
              notes: { type: ["string", "null"], description: "Commentaires, contexte commercial" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["confidence"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_rdv_data" } },
  };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false as const, status: response.status, error: text };
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return { ok: false as const, status: 500, error: "No tool call returned" };
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments) as ExtractedRdv;
    return { ok: true as const, data: parsed };
  } catch (e) {
    return { ok: false as const, status: 500, error: `Parse error: ${(e as Error).message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const images: ImageInput[] = Array.isArray(body.images) ? body.images : [];

    // Backward-compatible single image
    if (images.length === 0 && body.image_base64) {
      images.push({ data: body.image_base64, mime_type: body.mime_type });
    }

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (images.length > 5) {
      return new Response(
        JSON.stringify({ success: false, error: "Max 5 images per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayIso = new Date().toISOString().split("T")[0];
    const result = await callGeminiVision(images, todayIso, LOVABLE_API_KEY);

    if (!result.ok) {
      if (result.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "rate_limit",
            message: "Trop de requêtes IA. Réessayez dans un instant.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (result.status === 402) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "payment_required",
            message: "Crédits IA épuisés. Rechargez votre espace de travail.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", result.status, result.error);
      return new Response(
        JSON.stringify({ success: false, error: "ai_error", message: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-rdv-from-image error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
