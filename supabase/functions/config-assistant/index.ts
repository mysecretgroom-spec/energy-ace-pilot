import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT = 4000;
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_ROWS_CONTEXT = 200;
const MAX_CHANGES = 60;

interface FieldSpec {
  name: string;
  label: string;
  type: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

const SYSTEM_PROMPT = `Tu es un assistant de paramétrage pour une application de vente d'installations énergétiques
(photovoltaïque, pompes à chaleur, isolation extérieure).

L'utilisateur décrit, à l'oral, à l'écrit ou via un document, des modifications à apporter à SON paramétrage
(grilles tarifaires d'une régie, surcoûts, financements, gammes, aides et primes).

Tu reçois :
- le DOMAINE concerné et la liste EXACTE des champs autorisés (avec leur type et leurs bornes),
- le paramétrage ACTUEL sous forme de lignes JSON (chacune avec son "id"),
- la demande de l'utilisateur.

Tu dois produire une liste de CHANGEMENTS structurés :
- action "creer"    : nouvelle ligne (pas d'id)
- action "modifier" : reprend l'id EXACT d'une ligne existante et ne renseigne QUE les champs à changer
- action "supprimer": reprend l'id EXACT d'une ligne existante

Règles impératives :
1. N'utilise QUE les champs autorisés, avec les valeurs et unités demandées. Jamais d'id inventé.
2. Ne touche pas aux lignes non concernées par la demande.
3. Les lignes marquées "global": true sont des références partagées : tu ne peux ni les modifier ni les
   supprimer ; si l'utilisateur veut les changer, crée une ligne personnelle équivalente à la place.
4. Respecte les bornes min/max ; si une valeur demandée sort des bornes, ne propose pas ce changement.
5. Si la demande est ambiguë, propose le changement le plus prudent et explique-le dans "motif".
6. Explique ton raisonnement en français simple, sans jargon technique.

Réponds UNIQUEMENT en JSON :
{
  "resume": "une phrase décrivant l'ensemble des changements",
  "raisonnement": "3 à 6 phrases expliquant la logique retenue",
  "changements": [
    { "action": "modifier", "id": "...", "cible": "libellé de la ligne", "motif": "...", "valeurs": { ... } }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY manquante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Requête invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domaineLabel = typeof body.domaineLabel === "string" ? body.domaineLabel.slice(0, 200) : "";
    const domaineDescription =
      typeof body.domaineDescription === "string" ? body.domaineDescription.slice(0, 500) : "";
    const fields: FieldSpec[] = Array.isArray(body.fields) ? body.fields.slice(0, 40) : [];
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS_CONTEXT) : [];
    const texte = typeof body.texte === "string" ? body.texte.slice(0, MAX_TEXT) : "";
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
    const audioFormat = typeof body.audioFormat === "string" ? body.audioFormat.slice(0, 20) : "webm";
    const fileDataUrl = typeof body.fileDataUrl === "string" ? body.fileDataUrl : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "document";

    if (!domaineLabel || fields.length === 0) {
      return new Response(JSON.stringify({ error: "Domaine de paramétrage manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!texte && !audioBase64 && !fileDataUrl) {
      return new Response(JSON.stringify({ error: "Aucune demande fournie" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audioBase64.length > MAX_MEDIA_BYTES || fileDataUrl.length > MAX_MEDIA_BYTES) {
      return new Response(JSON.stringify({ error: "Fichier trop volumineux (max 12 Mo)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldsSpec = fields
      .map((f) => {
        const bornes =
          f.min != null || f.max != null ? ` [${f.min ?? "-∞"} → ${f.max ?? "+∞"}]` : "";
        const options = f.options?.length ? ` (${f.options.join(" | ")})` : "";
        return `- ${f.name} : ${f.label} — ${f.type}${options}${bornes}${f.required ? " (obligatoire à la création)" : ""}`;
      })
      .join("\n");

    const content: Record<string, unknown>[] = [
      {
        type: "text",
        text: `DOMAINE : ${domaineLabel}\n${domaineDescription}\n\nCHAMPS AUTORISÉS :\n${fieldsSpec}\n\nPARAMÉTRAGE ACTUEL (${rows.length} ligne(s)) :\n${JSON.stringify(rows).slice(0, 24000)}`,
      },
      {
        type: "text",
        text: texte
          ? `DEMANDE DE L'UTILISATEUR :\n${texte}`
          : "Déduis les modifications à apporter à partir du contenu joint.",
      },
    ];

    if (audioBase64) {
      content.push({ type: "input_audio", input_audio: { data: audioBase64, format: audioFormat } });
    }
    if (fileDataUrl) {
      if (fileDataUrl.startsWith("data:image/")) {
        content.push({ type: "image_url", image_url: { url: fileDataUrl } });
      } else {
        content.push({ type: "file", file: { filename: fileName, file_data: fileDataUrl } });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("AI gateway error", res.status, detail);
      const message =
        res.status === 429
          ? "Trop de requêtes, réessaie dans un instant."
          : res.status === 402
            ? "Crédits IA épuisés."
            : "Erreur de l'assistant IA.";
      return new Response(JSON.stringify({ error: message }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { resume?: unknown; raisonnement?: unknown; changements?: unknown[] } = {};
    try {
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      return new Response(JSON.stringify({ error: "Réponse IA illisible" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const knownIds = new Set(rows.map((r: Record<string, unknown>) => String(r?.id)));
    const allowedFields = new Set(fields.map((f) => f.name));
    const allowedActions = ["creer", "modifier", "supprimer"];

    const changements = (Array.isArray(parsed.changements) ? parsed.changements : [])
      .slice(0, MAX_CHANGES)
      .map((c: Record<string, unknown>) => {
        const action = allowedActions.includes(String(c?.action)) ? String(c.action) : "modifier";
        const id = c?.id ? String(c.id) : null;
        const valeursIn = (c?.valeurs && typeof c.valeurs === "object" ? c.valeurs : {}) as Record<
          string,
          unknown
        >;
        const valeurs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(valeursIn)) {
          if (allowedFields.has(k)) valeurs[k] = v;
        }
        return {
          action,
          id,
          cible: c?.cible ? String(c.cible).slice(0, 160) : null,
          motif: c?.motif ? String(c.motif).slice(0, 300) : null,
          valeurs,
        };
      })
      .filter((c) => (c.action === "creer" ? true : c.id != null && knownIds.has(c.id)))
      .filter((c) => c.action === "supprimer" || Object.keys(c.valeurs).length > 0);

    return new Response(
      JSON.stringify({
        resume: parsed.resume ? String(parsed.resume).slice(0, 400) : "",
        raisonnement: parsed.raisonnement ? String(parsed.raisonnement).slice(0, 2000) : "",
        changements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("config-assistant error", error);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
