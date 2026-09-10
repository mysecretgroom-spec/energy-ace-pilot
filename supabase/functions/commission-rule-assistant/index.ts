import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEXT = 4000;
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;

const SYSTEM_PROMPT = `Tu es un expert en rémunération commerciale du photovoltaïque (PV), pompes à chaleur (PAC) et isolation (ITE).

L'utilisateur décrit, à l'oral, à l'écrit ou via un document, une ou plusieurs règles de calcul de sa commission
(coûts régie, aides déduites, primes, bonus, frais partagés...).

Tu dois convertir cette description en règles STRUCTURÉES.

Champs par règle :
- nom : libellé court en français (ex: "Prime Coup de Pouce partagée")
- description : phrase expliquant la règle
- effet : "deduction" (retirée de la commission) | "bonus" (ajoutée) | "remplace_base" (remplace la commission de base)
- base : "fixe" (montant en euros) | "montant_ht" | "montant_ttc" | "commission_base" | "prime_coup_pouce" | "surcouts" | "decom" | "puissance_kwc"
- mode_valeur : "fixe" (la valeur est un multiplicateur/euros) | "pourcentage" (la valeur est un % de la base)
- valeur : nombre
- part_appliquee_pct : pourcentage réellement appliqué (100 par défaut ; 50 si le coût est partagé moitié-moitié avec la régie)
- product_type : "PV" | "PAC" | "ITE" ou null si tous produits
- gamme : nom de gamme ou null
- condition_min / condition_max : bornes en montant HT de la vente, ou null

Exemples :
- "la prime coup de pouce est partagée à 50% avec la régie" =>
  { effet: "deduction", base: "prime_coup_pouce", mode_valeur: "pourcentage", valeur: 100, part_appliquee_pct: 50 }
- "je déduis 150€ de frais de dossier par vente" =>
  { effet: "deduction", base: "fixe", mode_valeur: "fixe", valeur: 150, part_appliquee_pct: 100 }
- "bonus de 2% du montant HT au dessus de 20000€" =>
  { effet: "bonus", base: "montant_ht", mode_valeur: "pourcentage", valeur: 2, part_appliquee_pct: 100, condition_min: 20000 }

MODE CORRECTION : si une règle existante t'est fournie, tu dois la RENVOYER CORRIGÉE (mêmes champs),
en n'appliquant que les ajustements demandés et en conservant à l'identique tout ce qui n'est pas mentionné.

Si des règles existantes te sont fournies en contexte, évite de créer un doublon : préfère corriger.

Champs additionnels possibles :
- condition_base : "montant_ht" | "montant_ttc" | "puissance_kwc" (grandeur testée par condition_min/condition_max, défaut "montant_ht")

Réponds UNIQUEMENT en JSON : { "rules": [ ... ] }. Aucun texte autour.`;

const SCHEMA_PROMPT = `Tu es un expert en modèles de rémunération commerciale (photovoltaïque, PAC, isolation).

L'utilisateur veut CHANGER DE STYLE DE COMMISSIONNEMENT : il décrit, avec ses mots, un nouveau raisonnement complet
(ex : "je passe à 120 € par kWc au-delà de 3 kWc, moins la moitié des surcoûts", "commission = 8% du HT jusqu'à
20 000 € puis 12% au-delà, et la prime coup de pouce est à ma charge à 50%").

Tu dois RAISONNER puis traduire ce modèle en un ENSEMBLE COHÉRENT de règles applicables automatiquement.

Méthode :
1. Identifie la commission de BASE du nouveau modèle → une règle "remplace_base" (ordre 0).
   Si le modèle conserve le calcul historique (bouquet / pourcentage régie), n'ajoute PAS de "remplace_base".
2. Traduis chaque tranche en une règle distincte "remplace_base" bornée par condition_min / condition_max
   (avec condition_base = "montant_ht", "montant_ttc" ou "puissance_kwc" selon ce qui est décrit).
3. Ajoute ensuite les bonus et déductions (ordre croissant : 10, 20, 30...).
4. Vérifie la cohérence : pas de double comptage, bornes qui se suivent sans trou ni recouvrement,
   parts partagées exprimées via part_appliquee_pct.

Champs par règle : nom, description, effet ("deduction"|"bonus"|"remplace_base"),
base ("fixe"|"montant_ht"|"montant_ttc"|"commission_base"|"prime_coup_pouce"|"surcouts"|"decom"|"puissance_kwc"),
mode_valeur ("fixe"|"pourcentage"), valeur, part_appliquee_pct, product_type ("PV"|"PAC"|"ITE"|null),
gamme (ou null), condition_base, condition_min, condition_max, ordre.

Note : avec base "puissance_kwc" et mode_valeur "fixe", valeur = montant en € par kWc.

Réponds UNIQUEMENT en JSON :
{ "schema_nom": "...", "raisonnement": "explication en français, 3 à 6 phrases, du modèle retenu et de sa logique",
  "rules": [ ... ] }`;

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

    const texte = typeof body.texte === "string" ? body.texte.slice(0, MAX_TEXT) : "";
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
    const audioFormat = typeof body.audioFormat === "string" ? body.audioFormat : "webm";
    const fileDataUrl = typeof body.fileDataUrl === "string" ? body.fileDataUrl : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "document";

    if (!texte && !audioBase64 && !fileDataUrl) {
      return new Response(JSON.stringify({ error: "Aucune description fournie" }), {
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

    const ruleToEdit =
      body.rule && typeof body.rule === "object" ? JSON.stringify(body.rule).slice(0, 4000) : "";
    const existingRules = Array.isArray(body.existingRules)
      ? JSON.stringify(body.existingRules.slice(0, 30)).slice(0, 6000)
      : "";

    const content: Record<string, unknown>[] = [];
    if (ruleToEdit) {
      content.push({
        type: "text",
        text: `Règle existante à corriger :\n${ruleToEdit}\n\nCorrection demandée :\n${texte || "(voir contenu joint)"}\n\nRenvoie UNE seule règle corrigée.`,
      });
    } else {
      if (existingRules) {
        content.push({ type: "text", text: `Règles déjà configurées (contexte) :\n${existingRules}` });
      }
      content.push({
        type: "text",
        text: texte
          ? `Description de l'utilisateur :\n${texte}`
          : "Extrais les règles de commission de ce contenu.",
      });
    }
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: { rules?: unknown[] } = {};
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return new Response(JSON.stringify({ error: "Réponse IA illisible", raw }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedEffets = ["deduction", "bonus", "remplace_base"];
    const allowedBases = [
      "fixe",
      "montant_ht",
      "montant_ttc",
      "commission_base",
      "prime_coup_pouce",
      "surcouts",
      "decom",
      "puissance_kwc",
    ];

    const rules = (Array.isArray(parsed.rules) ? parsed.rules : [])
      .slice(0, 20)
      .map((r: Record<string, unknown>) => ({
        nom: String(r?.nom ?? "Règle").slice(0, 120),
        description: r?.description ? String(r.description).slice(0, 500) : null,
        effet: allowedEffets.includes(String(r?.effet)) ? String(r.effet) : "deduction",
        base: allowedBases.includes(String(r?.base)) ? String(r.base) : "fixe",
        mode_valeur: String(r?.mode_valeur) === "pourcentage" ? "pourcentage" : "fixe",
        valeur: Number(r?.valeur) || 0,
        part_appliquee_pct:
          r?.part_appliquee_pct == null ? 100 : Math.max(0, Math.min(100, Number(r.part_appliquee_pct) || 0)),
        product_type: ["PV", "PAC", "ITE"].includes(String(r?.product_type)) ? String(r.product_type) : null,
        gamme: r?.gamme ? String(r.gamme).slice(0, 100) : null,
        condition_min: r?.condition_min == null ? null : Number(r.condition_min) || null,
        condition_max: r?.condition_max == null ? null : Number(r.condition_max) || null,
      }));

    return new Response(JSON.stringify({ rules }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("commission-rule-assistant error", error);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
