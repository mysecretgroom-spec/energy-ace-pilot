import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { visitorGuard } from "../_shared/visitorGuard.ts";

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
  type_projet: string | null;
  notes: string | null;
  confidence: number; // 0..1
}

interface ExtractedRdvsResult {
  rdvs: ExtractedRdv[];
  confidence: number; // overall confidence
}

const SYSTEM_PROMPT = `Tu es un assistant expert en extraction d'informations de rendez-vous depuis des captures d'écran de CRM, emails, SMS, calendriers, fiches RDV ou notes manuscrites.

Ton rôle: analyser une ou plusieurs images et extraire TOUS les rendez-vous visibles avec un MAXIMUM DE FIDÉLITÉ. Ne saute AUCUNE info visible.

Règles GÉNÉRALES:
- Une seule image peut contenir PLUSIEURS rendez-vous distincts (ex: planning hebdo, liste d'appels). Renvoie un tableau "rdvs".
- Si plusieurs images: fusionne tous les RDV (dédupliquer si même personne + même date/heure).
- Date au format YYYY-MM-DD. "demain", "lundi prochain" → calcule par rapport à la date actuelle fournie.
- Heure au format HH:mm sur 24h. Si une plage est donnée ("13:30 à 15:00"), prends l'heure de DÉBUT (13:30).
- Téléphone: format français (0612345678 ou +33612345678). Retire tous les espaces/points.
- type_projet ∈ {photovoltaique, pompe_chaleur, isolation, ballon_thermo, autre}. Si plusieurs produits sont mentionnés (ex: "PAC + Ballon thermo + PV"), choisis le PRINCIPAL (souvent PV par défaut, ou celui mis en avant).
- Si une info n'est pas visible: null. NE JAMAIS inventer.

Règles ADRESSE (ULTRA IMPORTANT — souvent mal extraite):
- Cherche systématiquement un bloc "Adresse :", "Adr :", ou une ligne contenant un n° de rue + nom de voie + code postal + ville.
- Si tu trouves "8 Rue du Capitaine Mellows, 40000, Mont-de-Marsan" → adresse="8 Rue du Capitaine Mellows", code_postal="40000", ville="Mont-de-Marsan".
- DÉCOUPE TOUJOURS l'adresse complète en 3 champs séparés (adresse / code_postal / ville). Le champ "adresse" ne doit PAS contenir le CP ni la ville.
- Le code postal français = 5 chiffres. La ville suit le CP.
- Si l'adresse est sur plusieurs lignes (saut de ligne au milieu d'un nom de ville comme "Mont-\nde-Marsan"), recolle-la proprement → "Mont-de-Marsan".

Règles NOTES (capture les détails commerciaux):
- Concatène TOUT le contenu visible des sections "Instructions", "Notes", "Commentaires", "Commercial", "Description" dans le champ notes.
- Garde les détails utiles (revenus, surface, type de chauffage, situation perso, mentions "PAC", "Ballon thermo", "PV", commercial assigné, etc.).
- Préserve les retours à la ligne logiques mais sans excès.

Règles NOM/PRÉNOM:
- Si une seule chaîne après "Client :" (ex: "Saint-Guirons", "Dupont"), mets-la dans nom et laisse prenom=NULL. NE DUPLIQUE JAMAIS la même valeur dans nom ET prenom.
- Si "Dupont Jean" ou "Jean Dupont", sépare correctement.
- Si tu hésites, mets tout dans nom et laisse prenom=null.

Confidence:
- 0.9+ si nom + date + heure + adresse clairs.
- 0.6-0.8 si partiel.
- <0.5 si très incertain.
- Si AUCUN RDV identifiable: rdvs=[], confidence=0.`;

async function callGeminiVision(images: ImageInput[], todayIso: string, apiKey: string) {
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Date d'aujourd'hui: ${todayIso}. Analyse ${images.length === 1 ? "cette capture d'écran" : `ces ${images.length} captures d'écran`} et extrait TOUS les rendez-vous visibles (il peut y en avoir plusieurs dans une même image).`,
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

  const rdvSchema = {
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
  };

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
          name: "extract_rdvs_data",
          description: "Retourne TOUS les rendez-vous extraits (un ou plusieurs) sous forme de tableau structuré.",
          parameters: {
            type: "object",
            properties: {
              rdvs: {
                type: "array",
                description: "Liste de tous les rendez-vous identifiés dans les images.",
                items: rdvSchema,
              },
              confidence: { type: "number", minimum: 0, maximum: 1, description: "Confiance globale" },
            },
            required: ["rdvs", "confidence"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_rdvs_data" } },
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
    const parsed = JSON.parse(toolCall.function.arguments) as ExtractedRdvsResult;
    if (!Array.isArray(parsed.rdvs)) {
      return { ok: false as const, status: 500, error: "Missing rdvs array" };
    }
    return { ok: true as const, data: parsed };
  } catch (e) {
    return { ok: false as const, status: 500, error: `Parse error: ${(e as Error).message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  { const __visitor = visitorGuard(req, corsHeaders); if (__visitor) return __visitor; }

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

    if (images.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Max 10 images per request" }),
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

    // Sort RDVs by date+heure for stable A/B/C labeling
    const sorted = [...result.data.rdvs].sort((a, b) => {
      const aKey = `${a.date || "9999-99-99"}T${a.heure || "99:99"}`;
      const bKey = `${b.date || "9999-99-99"}T${b.heure || "99:99"}`;
      return aKey.localeCompare(bKey);
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          rdvs: sorted,
          confidence: result.data.confidence,
          // Backward-compatible: expose first RDV as `rdv` (single-RDV consumers)
          rdv: sorted[0] || null,
        },
      }),
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
