import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { visitorGuard } from "../_shared/visitorGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
  image_base64: string;
}

export type OcrIssueLevel = "error" | "warning";

export interface OcrIssue {
  field: string;
  level: OcrIssueLevel;
  message: string;
}

interface OCRResponse {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  commercant: string | null;
  date_debut: string | null;
  date_fin: string | null;
  /** 0 → 1, fiabilité globale de la lecture */
  confiance?: number;
  /** Champs signalés illisibles par le modèle */
  champs_illisibles?: string[];
  /** Qualité perçue de la photo : bonne | moyenne | mauvaise */
  qualite_image?: string;
  /** Erreurs / doutes de lecture à afficher à l'utilisateur */
  issues?: OcrIssue[];
  /** Modèle ayant produit le résultat retenu */
  model_used?: string;
  raw_text?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Modèle rapide en 1re passe, modèle plus fort en repli quand la lecture est douteuse
const FAST_MODEL = "google/gemini-3.1-flash-lite";
const STRONG_MODEL = "google/gemini-3.8-flash";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // ~12 Mo de base64

// Mapping of merchant patterns to categories
const merchantCategoryMap: Record<string, string[]> = {
  carburant: [
    "total", "shell", "bp", "esso", "avia", "intermarche", "leclerc", "carrefour",
    "super u", "auchan", "casino", "station", "petrole", "essence", "gazole", "diesel",
    "engie", "elan", "dyneff", "vito"
  ],
  peage: [
    "sanef", "aprr", "vinci", "cofiroute", "asf", "escota", "area", "autoroute",
    "peage", "péage", "toll", "a-way", "atlandes"
  ],
  repas: [
    "mcdo", "mcdonald", "burger", "kfc", "subway", "pizza", "resto", "restaurant",
    "brasserie", "cafe", "café", "bistro", "grill", "sushi", "kebab", "snack",
    "boulangerie", "patisserie", "pâtisserie", "traiteur", "buffalo", "hippopotamus",
    "courtepaille", "flunch", "leon", "paul", "starbucks", "quick", "five guys"
  ],
  hotel: [
    "hotel", "hôtel", "ibis", "novotel", "mercure", "accor", "b&b", "premiere classe",
    "campanile", "kyriad", "best western", "radisson", "marriott", "hilton", "holiday inn",
    "formule 1", "f1", "logis", "comfort inn", "airbnb", "booking"
  ],
  parking: [
    "parking", "parc auto", "effia", "indigo", "q-park", "vinci park", "interparking",
    "saemes", "zenpark", "onepark", "parcmetre"
  ],
  train: [
    "sncf", "ouigo", "tgv", "ter", "eurostar", "thalys", "inoui", "intercites",
    "trainline", "oui.sncf", "gare"
  ],
  location_vehicule: [
    "hertz", "avis", "europcar", "sixt", "enterprise", "budget", "national", "alamo",
    "getaround", "drivy", "ada", "rent a car", "rentacar", "loc auto", "location"
  ]
};

function deduceCategoryFromMerchant(merchantName: string | null): string | null {
  if (!merchantName) return null;
  const lowerName = merchantName.toLowerCase();
  for (const [category, keywords] of Object.entries(merchantCategoryMap)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) return category;
    }
  }
  return null;
}

const PROMPT = `Tu lis un ticket de caisse ou une facture française, souvent photographié de travers, froissé ou en impression thermique pâle.

Règles de lecture :
- Le montant TTC est le TOTAL réellement payé (mentions "TOTAL", "TOTAL TTC", "NET A PAYER", "MONTANT DU", "CB EMV", "DEBIT"). Ne prends jamais un sous-total, un montant de TVA, un rendu monnaie, un prix unitaire ou un montant de fidélité.
- Sur un ticket carburant, le total payé est le montant de la transaction, pas le prix au litre.
- Les décimales françaises utilisent la virgule ; "1 234,56" vaut 1234.56.
- Si un chiffre est ambigu (0/8, 1/7, 3/9, 5/6), ne devine pas : mets le champ à null et cite-le dans champs_illisibles.
- La date est celle du ticket, au format YYYY-MM-DD. Attention aux formats JJ/MM/AA. Ne renvoie jamais une date inventée.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
 "montant_ttc": number|null,
 "montant_ht": number|null,
 "tva": number|null,
 "taux_tva": number|null,
 "date": "YYYY-MM-DD"|null,
 "categorie": "carburant"|"peage"|"repas"|"hotel"|"parking"|"location_vehicule"|"train"|"autre",
 "description": string|null,
 "commercant": string|null,
 "date_debut": "YYYY-MM-DD"|null,
 "date_fin": "YYYY-MM-DD"|null,
 "confiance": number,
 "champs_illisibles": string[],
 "qualite_image": "bonne"|"moyenne"|"mauvaise"
}

- date_debut / date_fin uniquement pour une location de véhicule ou un séjour hôtelier (période couverte), sinon null.
- confiance : 0 à 1, ta certitude globale sur le montant TTC et la date.
- champs_illisibles : noms exacts des champs que tu n'as pas pu lire de façon sûre.
- Si le HT n'est pas imprimé mais que tu as le TTC et le taux, calcule-le.`;

async function callModel(model: string, imageUrl: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Gateway error (${model}):`, response.status, errorText);
    return { ok: false as const, status: response.status, error: errorText };
  }

  const aiResponse = await response.json();
  const content: string = aiResponse.choices?.[0]?.message?.content || "";
  const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return { ok: true as const, data: JSON.parse(clean) as OCRResponse, raw: content };
  } catch {
    console.error("Failed to parse AI response:", content.slice(0, 500));
    return { ok: false as const, status: 502, error: "unparsable", raw: content };
  }
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Contrôles de cohérence : produit la liste des erreurs de lecture à afficher. */
export function buildIssues(r: OCRResponse): OcrIssue[] {
  const issues: OcrIssue[] = [];
  const ttc = num(r.montant_ttc);
  const ht = num(r.montant_ht);
  const tva = num(r.tva);
  const taux = num(r.taux_tva);

  if (ttc === null) {
    issues.push({ field: "montant_ttc", level: "error", message: "Montant TTC non lu : saisissez-le manuellement." });
  } else if (ttc <= 0) {
    issues.push({ field: "montant_ttc", level: "error", message: "Montant TTC incohérent (≤ 0)." });
  } else if (ttc > 10000) {
    issues.push({ field: "montant_ttc", level: "warning", message: "Montant TTC inhabituellement élevé, à vérifier." });
  }

  if (ttc !== null && ht !== null && tva !== null) {
    if (Math.abs(ht + tva - ttc) > Math.max(0.05, ttc * 0.01)) {
      issues.push({ field: "montant_ht", level: "warning", message: "HT + TVA ne correspond pas au TTC lu." });
    }
  }
  if (ht !== null && ttc !== null && ht > ttc + 0.01) {
    issues.push({ field: "montant_ht", level: "warning", message: "Le HT est supérieur au TTC." });
  }
  if (taux !== null && ![0, 2.1, 5.5, 10, 20].some((t) => Math.abs(t - taux) < 0.3)) {
    issues.push({ field: "taux_tva", level: "warning", message: `Taux de TVA inhabituel (${taux} %).` });
  }

  if (!r.date) {
    issues.push({ field: "date", level: "error", message: "Date non lue : vérifiez-la." });
  } else {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) {
      issues.push({ field: "date", level: "error", message: "Date illisible." });
    } else {
      const now = Date.now();
      if (d.getTime() > now + 24 * 3600 * 1000) {
        issues.push({ field: "date", level: "error", message: "Date dans le futur, à corriger." });
      } else if (now - d.getTime() > 3 * 365 * 24 * 3600 * 1000) {
        issues.push({ field: "date", level: "warning", message: "Date de plus de 3 ans, à vérifier." });
      }
    }
  }

  if (!r.commercant) {
    issues.push({ field: "commercant", level: "warning", message: "Commerçant non lu." });
  }
  if (!r.categorie || r.categorie === "autre") {
    issues.push({ field: "categorie", level: "warning", message: "Catégorie non déterminée." });
  }
  if ((r.categorie === "location_vehicule" || r.categorie === "hotel") && (!r.date_debut || !r.date_fin)) {
    issues.push({ field: "date_debut", level: "warning", message: "Période de couverture incomplète." });
  }

  for (const champ of r.champs_illisibles ?? []) {
    if (!issues.some((i) => i.field === champ)) {
      issues.push({ field: champ, level: "warning", message: `Champ « ${champ} » difficile à lire sur la photo.` });
    }
  }

  if (r.qualite_image === "mauvaise") {
    issues.push({ field: "image", level: "warning", message: "Photo peu lisible : reprenez-la à plat et bien éclairée." });
  }
  if (typeof r.confiance === "number" && r.confiance < 0.6) {
    issues.push({ field: "image", level: "warning", message: "Lecture peu fiable, contrôlez tous les champs." });
  }

  return issues;
}

function needsSecondPass(r: OCRResponse, issues: OcrIssue[]): boolean {
  if (num(r.montant_ttc) === null) return true;
  if (typeof r.confiance === "number" && r.confiance < 0.75) return true;
  if (r.qualite_image === "mauvaise") return true;
  return issues.some((i) => i.level === "error");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  { const __visitor = visitorGuard(req, corsHeaders); if (__visitor) return __visitor; }

  try {
    const body = (await req.json()) as OCRRequest;
    const image_base64 = body?.image_base64;

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (image_base64.length > MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ error: "Image trop volumineuse (max 12 Mo)" }), {
        status: 413,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const imageUrl = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const first = await callModel(FAST_MODEL, imageUrl);

    let result: OCRResponse | null = first.ok ? first.data : null;
    let modelUsed = FAST_MODEL;
    let issues = result ? buildIssues(result) : [];

    if (!result || needsSecondPass(result, issues)) {
      const second = await callModel(STRONG_MODEL, imageUrl);
      if (second.ok) {
        const secondIssues = buildIssues(second.data);
        const firstErrors = result ? issues.filter((i) => i.level === "error").length : Infinity;
        const secondErrors = secondIssues.filter((i) => i.level === "error").length;
        if (!result || secondErrors <= firstErrors) {
          result = second.data;
          issues = secondIssues;
          modelUsed = STRONG_MODEL;
        }
      } else if (!result) {
        return new Response(
          JSON.stringify({
            error: "AI processing failed",
            issues: [{ field: "image", level: "error", message: "L'analyse a échoué, réessayez avec une photo plus nette." }],
          }),
          { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Catégorie déduite du commerçant si le modèle ne l'a pas trouvée
    if ((!result!.categorie || result!.categorie === "autre") && result!.commercant) {
      const deduced = deduceCategoryFromMerchant(result!.commercant);
      if (deduced) {
        result!.categorie = deduced;
        issues = buildIssues(result!);
      }
    }

    // Complète le HT / TVA quand seuls le TTC et le taux sont lisibles
    const ttc = num(result!.montant_ttc);
    const taux = num(result!.taux_tva);
    if (ttc !== null && taux !== null && taux > 0) {
      if (num(result!.montant_ht) === null) {
        result!.montant_ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
      }
      if (num(result!.tva) === null && num(result!.montant_ht) !== null) {
        result!.tva = Math.round((ttc - (result!.montant_ht as number)) * 100) / 100;
      }
    }

    const payload: OCRResponse = { ...result!, issues, model_used: modelUsed };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("OCR error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Erreur inconnue" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
