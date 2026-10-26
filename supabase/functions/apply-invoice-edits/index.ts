import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checkUsageBudget, logUsage, resolveUserId, HARD_CAP_MESSAGE } from "../_shared/aiUsage.ts";
import { visitorWriteGuard } from "../_shared/visitorGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const ALLOWED_CATEGORIES = [
  "carburant", "peage", "repas", "hotel", "parking", "train", "location_vehicule", "autre",
];

interface InvoiceLite {
  index: number;
  fournisseur?: string | null;
  date?: string | null;
  montant_ttc?: number | null;
  taux_tva?: number | null;
  categorie?: string | null;
  description?: string | null;
}

interface Patch {
  index: number;
  patch: {
    fournisseur?: string | null;
    date?: string | null;
    montant_ttc?: number | null;
    taux_tva?: number | null;
    categorie?: string | null;
    description?: string | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  { const __visitor = visitorWriteGuard(req, corsHeaders); if (__visitor) return __visitor; }

  try {
    const body = await req.json();
    const invoices: InvoiceLite[] = Array.isArray(body?.invoices) ? body.invoices : [];
    const instruction: string = String(body?.instruction || "").trim();
    const bodyUserId: string | undefined = body?.user_id;

    if (!instruction) {
      return new Response(JSON.stringify({ error: "instruction required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (invoices.length === 0) {
      return new Response(JSON.stringify({ error: "invoices required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = await resolveUserId(req, bodyUserId);
    const budget = await checkUsageBudget(userId, "apply-invoice-edits");
    if (budget.blocked) {
      return new Response(JSON.stringify({ error: HARD_CAP_MESSAGE }), {
        status: 402, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const model = budget.forceModel || "google/gemini-2.5-flash";

    const numbered = invoices.map((inv) => ({
      numero: inv.index + 1,
      fournisseur: inv.fournisseur ?? null,
      date: inv.date ?? null,
      montant_ttc: inv.montant_ttc ?? null,
      taux_tva: inv.taux_tva ?? null,
      categorie: inv.categorie ?? null,
      description: inv.description ?? null,
    }));

    const systemPrompt = `Tu es un assistant qui applique des modifications à une liste numérotée de factures.
L'utilisateur t'envoie une instruction libre où il référence chaque facture par son numéro (1, 2, 3...).
Tu renvoies UNIQUEMENT les champs modifiés pour les factures explicitement citées.

Règles strictes:
- Catégories autorisées: ${ALLOWED_CATEGORIES.join(", ")}
- Dates au format ISO yyyy-mm-dd. Si l'utilisateur dit "12/04" sans année, utilise l'année courante.
- Montants en nombres décimaux (point comme séparateur).
- taux_tva est un pourcentage entier (ex: 10, 20, 5.5).
- N'invente rien: si l'instruction ne touche pas une facture, ne la mets pas dans patches.
- Si un champ n'est pas modifié, ne l'inclus pas dans le patch correspondant.
- Réponds STRICTEMENT en JSON: {"patches":[{"index":<numero-1>,"patch":{...}}]}
- "index" est le numéro affiché MOINS UN (numéro 1 -> index 0).`;

    const userPrompt = `Factures actuelles (JSON):
${JSON.stringify(numbered, null, 2)}

Instruction utilisateur:
"""
${instruction}
"""

Renvoie le JSON des patches.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit" }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits IA épuisés" }), {
        status: 402, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[apply-invoice-edits] AI error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 502, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content || "{}";

    logUsage({
      userId,
      functionName: "apply-invoice-edits",
      model,
      usage: aiJson?.usage,
    }).catch(() => {});

    let parsed: { patches?: Patch[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const rawPatches: Patch[] = Array.isArray(parsed.patches) ? parsed.patches : [];

    const sanitized: Patch[] = [];
    for (const p of rawPatches) {
      if (typeof p?.index !== "number") continue;
      if (p.index < 0 || p.index >= invoices.length) continue;
      const src = p.patch || {};
      const out: Patch["patch"] = {};
      if (typeof src.fournisseur === "string") out.fournisseur = src.fournisseur.trim() || null;
      if (typeof src.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src.date)) out.date = src.date;
      if (typeof src.montant_ttc === "number" && Number.isFinite(src.montant_ttc)) out.montant_ttc = src.montant_ttc;
      if (typeof src.taux_tva === "number" && Number.isFinite(src.taux_tva)) out.taux_tva = src.taux_tva;
      if (typeof src.categorie === "string" && ALLOWED_CATEGORIES.includes(src.categorie)) out.categorie = src.categorie;
      if (typeof src.description === "string") out.description = src.description.trim() || null;
      if (Object.keys(out).length > 0) sanitized.push({ index: p.index, patch: out });
    }

    return new Response(JSON.stringify({ patches: sanitized }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("[apply-invoice-edits] exception", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
