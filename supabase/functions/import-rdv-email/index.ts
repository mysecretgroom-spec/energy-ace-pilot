import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── SCHEMAS ──────────────────────────────────────────────────────────────────

const ContactSchema = z.object({
  nom: z.string().min(1).max(100).transform(v => v.replace(/[^\p{L}\s\-'.]/gu, "").trim()),
  prenom: z.string().max(100).optional().transform(v => v?.replace(/[^\p{L}\s\-'.]/gu, "").trim() || undefined),
  telephone: z.string().optional(),
  telephone_secondaire: z.string().optional(),
  email: z.string().optional().transform(v => {
    if (!v || v.trim() === "") return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(v) ? v.toLowerCase() : undefined;
  }),
});

const AdresseSchema = z.object({
  adresse: z.string().max(500).optional(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Invalid postal code").optional().or(z.literal("")).transform(v => v || undefined),
  ville: z.string().max(100).optional(),
});

const RdvSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  heure: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  duree_minutes: z.number().min(15).max(480).optional(),
  type_projet: z.string().max(50).optional(),
  commentaire: z.string().max(5000).optional(),
  commentaire_regie: z.string().max(5000).optional(),
});

const ProjetSchema = z.object({
  type_chauffage: z.string().max(50).optional(),
  type_toiture: z.string().max(50).optional(),
  orientation_toiture: z.string().max(50).optional(),
  facture_energie: z.number().min(0).max(100000).optional(),
  motivation: z.string().max(500).optional(),
  budget_estime: z.number().min(0).max(1000000).optional(),
  urgence: z.string().max(50).optional(),
}).optional();

const ExtractedLeadSchema = z.object({
  CONTACT: ContactSchema,
  ADRESSE: AdresseSchema.optional().default({}),
  RDV: RdvSchema.optional().default({}),
  PROJET: ProjetSchema,
});

type ValidatedLead = z.infer<typeof ExtractedLeadSchema>;

// ── AI EXTRACTION ─────────────────────────────────────────────────────────────

interface ExtractedLead {
  CONTACT: {
    nom: string;
    prenom?: string;
    telephone?: string;
    telephone_secondaire?: string;
    email?: string;
  };
  ADRESSE: {
    adresse?: string;
    code_postal?: string;
    ville?: string;
  };
  RDV: {
    date?: string;
    heure?: string;
    duree_minutes?: number;
    type_projet?: string;
    commentaire?: string;
    commentaire_regie?: string;
  };
  PROJET?: {
    type_chauffage?: string;
    type_toiture?: string;
    orientation_toiture?: string;
    facture_energie?: number;
    motivation?: string;
    budget_estime?: number;
    urgence?: string;
  };
}

async function extractLeadWithAI(emailBody: string, subject: string, intent: string): Promise<ExtractedLead | null> {
  const isInstallation = intent === "installation";
  const isReport = intent === "report";

  const intentContext = isInstallation
    ? `\n\n⚠️ CET EMAIL CONCERNE UN RENDEZ-VOUS D'INSTALLATION (le technicien va poser le matériel ou signer les documents finaux). La durée sera courte (~30 min). Extrait le nom du client, l'adresse et la date/heure d'installation.`
    : isReport
    ? `\n\n⚠️ CET EMAIL CONCERNE UN RDV REPORTÉ/REPROGRAMMÉ. Cherche le nouveau créneau (nouvelle date/heure) et les coordonnées du client existant.`
    : "";

  const systemPrompt = `Tu es un expert en extraction de données structurées depuis des emails de leads pour entreprises d'énergie renouvelable.${intentContext}

MISSION: Analyse le SUJET et le CONTENU de l'email pour extraire TOUTES les informations en JSON.

## FORMATS D'EMAIL COURANTS À RECONNAÎTRE:

### Format 1 - Clé:Valeur (le plus courant)
\`\`\`
Statut call: RDV Confirmé
Civilité: M.
Nom: FOUSSAT
Prénom: Franck
Adresse: 21 ROUTE DES POIRIERS
Code postal: 19240
Ville: SAINT-VIANCE
Date du RDV:29/01/2026
Heure du RDV: 13:00
\`\`\`

### Format 2 - Tableau HTML aplati
### Format 3 - Informations dans le SUJET
### Format 4 - Email narratif/prose
### Format 5 - Format Calendrier/iCal (VEVENT)
Le contenu peut inclure une section "--- DONNÉES AGENDA (iCal) ---" contenant des données structurées extraites d'une pièce jointe calendrier. Ces données sont PRIORITAIRES car elles contiennent souvent le numéro de téléphone du client et le commentaire du télépro.

### Format 6 - Données cachées dans le HTML
Certains emails contiennent des données dans des éléments HTML masqués (display:none, hidden inputs, data-attributes). Ces données sont pré-extraites et ajoutées au contenu.

## RÈGLES D'EXTRACTION CRITIQUES:

1. **DATES** - PRIORITÉ AU SUJET puis au corps. Convertis TOUS les formats en YYYY-MM-DD:
   - "29/01/2026" → "2026-01-29"
   - "20260205" (format iCal) → "2026-02-05"

2. **HEURES** - Convertis en HH:MM:
   - "10h00" → "10:00", "T130000" → "13:00"

3. **TÉLÉPHONES** - Extrait les 10 chiffres français. Cherche dans TOUTES les sections y compris les données iCal.

4. **TYPE DE PROJET** - Utilise UNIQUEMENT:
   - "photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", "autre"

5. **COMMENTAIRES** - TRÈS IMPORTANT: Rassemble TOUTES les informations contextuelles dans UN SEUL champ "commentaire". Concatène dans cet ordre :
   - D'abord le commentaire du télépro/confirmateur (issu de la Description iCal, des données masquées HTML, ou d'un champ "commentaire" dans l'email)
   - Puis les notes internes, observations visibles dans le corps de l'email (ex: "Client intéressé par 6kWc", "Maison ancienne", statut du call, motivation, etc.)
   - Sépare les différentes parties par un retour à la ligne.
   - Ne sacrifie JAMAIS le contenu visible au profit des données cachées, inclus TOUT.
   - Le champ "commentaire_regie" N'EST PLUS UTILISÉ, mets tout dans "commentaire".

6. **RÈGLE ABSOLUE** - Si une info n'est pas dans l'email, NE METS PAS le champ. Jamais "INCONNU".

7. **ADRESSE** - Sépare toujours: adresse (numéro + rue), code_postal (5 chiffres), ville. L'adresse complète est OBLIGATOIRE. Cherche-la dans TOUS les champs (sujet, corps, iCal LOCATION, signature).

8. **PRÉNOM** - Le prénom est OBLIGATOIRE. Cherche-le dans tous les champs disponibles. Si le nom complet est sur une seule ligne (ex: "DUPONT Jean"), sépare nom et prénom.

## STRUCTURE JSON ATTENDUE:
{
  "CONTACT": { "nom": "FOUSSAT", "prenom": "Franck", "telephone": "0612345678" },
  "ADRESSE": { "adresse": "21 ROUTE DES POIRIERS", "code_postal": "19240", "ville": "SAINT-VIANCE" },
  "RDV": { "date": "2026-02-05", "heure": "13:00", "type_projet": "photovoltaique", "commentaire": "..." },
  "PROJET": { "facture_energie": 335 }
}

RETOURNE UNIQUEMENT LE JSON, sans markdown ni commentaires.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `SUJET DE L'EMAIL:\n${subject}\n\n---\n\nCONTENU DE L'EMAIL:\n${emailBody}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    jsonStr = jsonStr.trim();
    const parsed = JSON.parse(jsonStr);
    console.log("AI extracted data:", JSON.stringify(parsed, null, 2));
    return parsed as ExtractedLead;
  } catch (error) {
    console.error("AI extraction error:", error);
    return null;
  }
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("33") && digits.length === 11) digits = "0" + digits.slice(2);
  if (digits.startsWith("0033")) digits = "0" + digits.slice(4);
  if (digits.length !== 10) return null;
  if (!digits.startsWith("0")) return null;
  return digits;
}

/**
 * Fallback phone extraction from raw email body using regex patterns.
 * Used when AI fails to extract a phone number.
 */
function extractPhoneFromBodyFallback(body: string): string | null {
  // Patterns ordered by specificity (labeled phones first, then standalone)
  const labeledPatterns = [
    // "Téléphone: 06 12 34 56 78" or "Tel : 0612345678"
    /(?:t[ée]l[ée]?phone|portable|mobile|gsm|num[ée]ro|t[ée]l|phone|fixe)\s*[:=]?\s*((?:\+33|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4})/gi,
    // "Téléphone (tableau): 06 12 34 56 78" (from our HTML extraction)
    /(?:t[ée]l[ée]?phone|portable|mobile)\s*\([^)]*\)\s*[:=]?\s*((?:\+33|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4})/gi,
  ];

  for (const pattern of labeledPatterns) {
    const match = pattern.exec(body);
    if (match) {
      const normalized = normalizePhone(match[1]);
      if (normalized) return normalized;
    }
  }

  // Standalone French phone numbers (06/07 mobile preferred)
  const mobilePattern = /(?<!\d)(0[67][\s.\-]?\d{2}(?:[\s.\-]?\d{2}){3})(?!\d)/g;
  const mobileMatch = mobilePattern.exec(body);
  if (mobileMatch) {
    const normalized = normalizePhone(mobileMatch[1]);
    if (normalized) return normalized;
  }

  // Any French phone number
  const anyPhonePattern = /(?<!\d)((?:\+33|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4})(?!\d)/g;
  const anyMatch = anyPhonePattern.exec(body);
  if (anyMatch) {
    const normalized = normalizePhone(anyMatch[1]);
    if (normalized) return normalized;
  }

  return null;
}

function validateLeadData(extracted: ExtractedLead): ValidatedLead | null {
  try {
    const dataToValidate = {
      CONTACT: {
        nom: extracted.CONTACT?.nom || "",
        prenom: extracted.CONTACT?.prenom,
        telephone: extracted.CONTACT?.telephone,
        telephone_secondaire: extracted.CONTACT?.telephone_secondaire,
        email: extracted.CONTACT?.email,
      },
      ADRESSE: extracted.ADRESSE || {},
      RDV: extracted.RDV || {},
      PROJET: extracted.PROJET,
    };
    return ExtractedLeadSchema.parse(dataToValidate);
  } catch (validationError) {
    console.error("Validation error:", validationError);
    if (extracted.CONTACT?.nom) {
      try {
        const minimalData = {
          CONTACT: { nom: extracted.CONTACT.nom.slice(0, 100).replace(/[^\p{L}\s\-'.]/gu, "") },
          ADRESSE: {},
          RDV: {},
        };
        return ExtractedLeadSchema.parse(minimalData);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildDateHeure(date: string | undefined, heure: string | undefined): string {
  if (date) {
    const time = heure || "09:00";
    const month = parseInt(date.split("-")[1], 10);
    const day = parseInt(date.split("-")[2], 10);
    const isSummerTime = (month > 3 && month < 10) ||
      (month === 3 && day >= 25) ||
      (month === 10 && day <= 27);
    const offset = isSummerTime ? "+02:00" : "+01:00";
    return `${date}T${time}:00${offset}`;
  }
  // Default: tomorrow 09:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T09:00:00+01:00`;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_email, subject, body, user_id, regie_id, intent = "nouveau_rdv" } = await req.json();

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body || typeof body !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing email body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid user_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (regie_id && !uuidRegex.test(regie_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid regie_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing email (intent=${intent}) from ${sender_email}: ${subject}`);

    // ── AI EXTRACTION ────────────────────────────────────────────────────────
    const extracted = await extractLeadWithAI(body, subject, intent);

    if (!extracted || !extracted.CONTACT?.nom) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract lead data (nom manquant)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validated = validateLeadData(extracted);
    if (!validated) {
      return new Response(
        JSON.stringify({ success: false, error: "Data validation failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MANDATORY FIELDS VALIDATION ──────────────────────────────────────────
    // Track missing mandatory fields for AI agent follow-up
    const missingFields: string[] = [];
    if (!validated.CONTACT.prenom) missingFields.push("prenom");
    if (!validated.ADRESSE?.adresse) missingFields.push("adresse");
    if (!validated.ADRESSE?.code_postal) missingFields.push("code_postal");
    if (!validated.ADRESSE?.ville) missingFields.push("ville");

    const hasCompleteAddress = !missingFields.includes("adresse") && 
                                !missingFields.includes("code_postal") && 
                                !missingFields.includes("ville");
    const hasMissingMandatoryFields = missingFields.length > 0;

    console.log(`Mandatory fields check: missing=[${missingFields.join(",")}] complete_address=${hasCompleteAddress}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const phone1 = normalizePhone(validated.CONTACT.telephone);
    const phone2 = normalizePhone(validated.CONTACT.telephone_secondaire);
    const email = validated.CONTACT.email?.toLowerCase();

    // ── FUZZY MATCHING HELPERS ─────────────────────────────────────────────
    function normalizeStr(s: string): string {
      return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    function stringSimilarity(a: string, b: string): number {
      const na = normalizeStr(a);
      const nb = normalizeStr(b);
      if (na === nb) return 1;
      if (na.length === 0 || nb.length === 0) return 0;
      // Levenshtein-based similarity
      const matrix: number[][] = [];
      for (let i = 0; i <= na.length; i++) { matrix[i] = [i]; }
      for (let j = 0; j <= nb.length; j++) { matrix[0][j] = j; }
      for (let i = 1; i <= na.length; i++) {
        for (let j = 1; j <= nb.length; j++) {
          const cost = na[i - 1] === nb[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
      }
      return 1 - matrix[na.length][nb.length] / Math.max(na.length, nb.length);
    }

    function nameMatchScore(
      extractedNom: string, extractedPrenom: string | undefined,
      dbNom: string, dbPrenom: string | null
    ): number {
      const en = normalizeStr(extractedNom);
      const ep = extractedPrenom ? normalizeStr(extractedPrenom) : "";
      const dn = normalizeStr(dbNom);
      const dp = dbPrenom ? normalizeStr(dbPrenom) : "";

      // Direct match: nom↔nom, prenom↔prenom
      const directNom = stringSimilarity(en, dn);
      const directPrenom = (ep && dp) ? stringSimilarity(ep, dp) : ((!ep && !dp) ? 1 : 0.5);
      const directScore = directNom * 0.6 + directPrenom * 0.4;

      // Swapped match: nom↔prenom, prenom↔nom (the Marecchia/Vivie case)
      let swapScore = 0;
      if (ep && dp) {
        const swapNom = stringSimilarity(en, dp);
        const swapPrenom = stringSimilarity(ep, dn);
        swapScore = swapNom * 0.6 + swapPrenom * 0.4;
      }

      // Full name as single string comparison (handles "VIVIE Marecchia" vs "MARECCHIA Vivie")
      const extractedFull = `${en} ${ep}`.trim();
      const dbFull = `${dn} ${dp}`.trim();
      const dbFullReversed = `${dp} ${dn}`.trim();
      const fullScore = Math.max(stringSimilarity(extractedFull, dbFull), stringSimilarity(extractedFull, dbFullReversed));

      return Math.max(directScore, swapScore, fullScore);
    }

    // ── CLIENT LOOKUP / CREATION ─────────────────────────────────────────────
    let existingClient: { id: string; nom: string } | null = null;

    // Step 1: Phone match (highest confidence)
    if (phone1) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .or(`telephone.eq.${phone1},telephone_secondaire.eq.${phone1}`)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }

    // Step 2: Email match
    if (!existingClient && email) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }

    // Step 3: Exact nom + code_postal
    if (!existingClient && validated.CONTACT.nom && validated.ADRESSE?.code_postal) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .eq("user_id", user_id)
        .ilike("nom", validated.CONTACT.nom)
        .eq("code_postal", validated.ADRESSE.code_postal)
        .limit(1)
        .maybeSingle();
      if (data) existingClient = { id: data.id, nom: data.nom };
    }

    // Step 4: Fuzzy name match with nom/prénom swap detection + address/postal code
    if (!existingClient && validated.CONTACT.nom) {
      const cp = validated.ADRESSE?.code_postal;
      const ville = validated.ADRESSE?.ville;

      // Fetch candidates: same code_postal OR same ville for narrowing
      let query = supabase
        .from("clients")
        .select("id, nom, prenom, code_postal, ville, adresse")
        .eq("user_id", user_id);

      if (cp && ville) {
        query = query.or(`code_postal.eq.${cp},ville.ilike.${ville}`);
      } else if (cp) {
        query = query.eq("code_postal", cp);
      } else if (ville) {
        query = query.ilike("ville", ville);
      }

      const { data: candidates } = await query.limit(50);

      if (candidates && candidates.length > 0) {
        let bestMatch: { id: string; nom: string; score: number } | null = null;

        for (const c of candidates) {
          const score = nameMatchScore(
            validated.CONTACT.nom, validated.CONTACT.prenom,
            c.nom, c.prenom
          );

          // Boost score if address also matches
          let addrBoost = 0;
          if (validated.ADRESSE?.adresse && c.adresse) {
            const addrSim = stringSimilarity(validated.ADRESSE.adresse, c.adresse);
            if (addrSim > 0.6) addrBoost = 0.15;
          }

          const finalScore = Math.min(score + addrBoost, 1);

          if (finalScore > (bestMatch?.score || 0)) {
            bestMatch = { id: c.id, nom: c.nom, score: finalScore };
          }
        }

        // Threshold: 0.75 = high confidence fuzzy match
        if (bestMatch && bestMatch.score >= 0.75) {
          existingClient = { id: bestMatch.id, nom: bestMatch.nom };
          console.log(`Fuzzy matched client: ${bestMatch.nom} (score=${bestMatch.score.toFixed(2)})`);
        }
      }
    }

    // Step 5: Fallback — try matching prenom as nom (full swap with no location)
    if (!existingClient && validated.CONTACT.prenom) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .eq("user_id", user_id)
        .ilike("nom", validated.CONTACT.prenom)
        .limit(5);

      if (data) {
        for (const c of data) {
          if (c.prenom && stringSimilarity(validated.CONTACT.nom, c.prenom) > 0.8) {
            existingClient = { id: c.id, nom: c.nom };
            console.log(`Name-swap matched client: extracted(${validated.CONTACT.nom}/${validated.CONTACT.prenom}) → db(${c.nom}/${c.prenom})`);
            break;
          }
        }
      }
    }

    let clientId: string;
    let action: "created" | "updated" = "created";
    let isDuplicateClient = false;

    if (existingClient) {
      clientId = existingClient.id;
      action = "updated";
      console.log(`Found existing client: ${existingClient.nom} (${clientId})`);

      // ── CHECK FOR R2 CONFIRMATION ────────────────────────────────────────
      // If the client has an existing R2/R2_prestudy RDV, this email is likely
      // a confirmation of that R2, not a new appointment or a duplicate.
      if (intent === "nouveau_rdv" && validated.RDV?.date) {
        const rdvDate = validated.RDV.date;
        
        // Look for an existing R2/R2_prestudy or Reporté RDV for this client
        // If found, this email is a confirmation — update instead of creating a duplicate
        const { data: pendingRdvs } = await supabase
          .from("rdv")
          .select("id, date_heure, status, needs_reconfirmation")
          .eq("client_id", clientId)
          .eq("user_id", user_id)
          .in("status", ["r2", "r2_prestudy", "reporte"])
          .order("date_heure", { ascending: false })
          .limit(1);

        if (pendingRdvs && pendingRdvs.length > 0) {
          const pendingRdv = pendingRdvs[0];
          const isR2 = pendingRdv.status === "r2" || pendingRdv.status === "r2_prestudy";
          const isReporte = pendingRdv.status === "reporte";
          const newDateHeure = buildDateHeure(validated.RDV?.date, validated.RDV?.heure);
          const intentLabel = isR2 ? "R2" : "Reporté";
          const actionType = isR2 ? "rdv_r2_confirmed" : "rdv_reporte_confirmed";
          const emailIntent = isR2 ? "r2_confirmation" : "reporte_confirmation";
          
          console.log(`${intentLabel} confirmation detected: updating existing ${intentLabel} RDV ${pendingRdv.id} for client ${clientId}`);
          
          // For reporté RDVs, reset status to "nouveau" since it's being rescheduled
          const updateData: Record<string, unknown> = {
            date_heure: newDateHeure,
            needs_reconfirmation: false,
            commentaire: validated.RDV?.commentaire || null,
            metadata: {
              ai_extracted: true,
              extraction_date: new Date().toISOString(),
              email_intent: emailIntent,
              [`${isR2 ? "r2" : "reporte"}_confirmed_from_email`]: true,
            },
          };
          
          if (isReporte) {
            updateData.status = "nouveau";
          }
          
          await supabase
            .from("rdv")
            .update(updateData)
            .eq("id", pendingRdv.id);

          // Log the confirmation
          await supabase.from("historique_actions").insert({
            user_id,
            client_id: clientId,
            action_type: actionType,
            description: `${intentLabel} confirmé par email (${sender_email?.slice(0, 100) || "email"}) — RDV mis à jour au ${rdvDate}`,
          });

          return new Response(
            JSON.stringify({
              success: true,
              action: isR2 ? "r2_confirmed" : "reporte_confirmed",
              client_id: clientId,
              rdv_id: pendingRdv.id,
              reason: `RDV ${intentLabel} existant confirmé et mis à jour`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Standard same-date duplicate check (no R2 found)
        const { data: sameDateRdvs } = await supabase
          .from("rdv")
          .select("id")
          .eq("client_id", clientId)
          .eq("user_id", user_id)
          .not("status", "in", '("reporte","annule")')
          .not("type_rdv", "eq", "installation")
          .gte("date_heure", `${rdvDate}T00:00:00`)
          .lte("date_heure", `${rdvDate}T23:59:59`)
          .limit(1);

        if (sameDateRdvs && sameDateRdvs.length > 0) {
          console.log(`Skipping: client ${clientId} already has an RDV on ${rdvDate}`);
          return new Response(
            JSON.stringify({
              success: true,
              action: "skipped",
              client_id: clientId,
              reason: "RDV existant pour ce client à cette date",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { data: existingRdvs } = await supabase
        .from("rdv")
        .select("id, status")
        .eq("client_id", clientId)
        .eq("user_id", user_id)
        .not("status", "in", '("reporte","annule")')
        .limit(1);

      if (existingRdvs && existingRdvs.length > 0) {
        isDuplicateClient = true;
      }

      const updateData: Record<string, unknown> = {};
      if (phone2) updateData.telephone_secondaire = phone2;
      if (email) updateData.email = email;
      if (Object.keys(updateData).length > 0) {
        await supabase.from("clients").update(updateData).eq("id", clientId);
      }
    } else {
      // Create new client
      const clientNotes: string[] = [];
      if (validated.RDV?.commentaire_regie) clientNotes.push(validated.RDV.commentaire_regie);
      if (validated.RDV?.commentaire) clientNotes.push(validated.RDV.commentaire);

      const clientData = {
        user_id,
        nom: validated.CONTACT.nom.toUpperCase(),
        prenom: validated.CONTACT.prenom || null,
        telephone: phone1,
        telephone_secondaire: phone2,
        email,
        adresse: validated.ADRESSE?.adresse || null,
        code_postal: validated.ADRESSE?.code_postal || null,
        ville: validated.ADRESSE?.ville || null,
        source: sender_email?.slice(0, 255) || null,
        regie_id: regie_id || null,
        notes: clientNotes.length > 0 ? clientNotes.join("\n\n") : null,
        metadata: {
          ...(validated.PROJET ? {
            type_chauffage: validated.PROJET.type_chauffage,
            type_toiture: validated.PROJET.type_toiture,
            orientation_toiture: validated.PROJET.orientation_toiture,
            facture_energie: validated.PROJET.facture_energie,
            projet_motivation: validated.PROJET.motivation,
            budget_estime: validated.PROJET.budget_estime,
            urgence: validated.PROJET.urgence,
          } : {}),
          ...(hasMissingMandatoryFields ? { missing_fields: missingFields, needs_completion: true } : {}),
        },
      };

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert(clientData)
        .select("id")
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create client" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      clientId = newClient.id;
      console.log(`Created new client: ${validated.CONTACT.nom} (${clientId})`);
    }

    // ── RDV CONFIGURATION BY INTENT ──────────────────────────────────────────

    const dateHeure = buildDateHeure(validated.RDV?.date, validated.RDV?.heure);

    // Map type_projet
    const validProjectTypes = ["photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", "autre"];
    let typeProjet = validated.RDV?.type_projet?.toLowerCase() || "photovoltaique";
    if (typeProjet.includes("solaire") || typeProjet.includes("pv") || typeProjet.includes("panneau")) typeProjet = "photovoltaique";
    else if (typeProjet.includes("pac") || typeProjet.includes("chaleur") || typeProjet.includes("pompe")) typeProjet = "pompe_chaleur";
    else if (typeProjet.includes("isol") || typeProjet.includes("ite")) typeProjet = "isolation";
    else if (typeProjet.includes("ballon") || typeProjet.includes("thermo") || typeProjet.includes("ecs")) typeProjet = "ballon_thermo";
    else if (!validProjectTypes.includes(typeProjet)) typeProjet = "photovoltaique";

    // Build commentaire — merge all sources into a single block
    const commentParts: string[] = [];
    if (validated.RDV?.commentaire_regie) commentParts.push(validated.RDV.commentaire_regie);
    if (validated.RDV?.commentaire) commentParts.push(validated.RDV.commentaire);
    const fullCommentaire = commentParts.join("\n") || null;

    // Intent-specific RDV properties
    let typeRdv = "standard";
    let rdvStatus = "nouveau";
    let durationMinutes = validated.RDV?.duree_minutes || 90;

    if (intent === "installation") {
      // Installation appointment: short visit (~30 min), different type
      typeRdv = "installation";
      rdvStatus = "nouveau";
      durationMinutes = validated.RDV?.duree_minutes || 30;
    } else if (intent === "report") {
      // Rescheduled appointment: standard type, "reporte" flag handled by parent logic
      typeRdv = "standard";
      rdvStatus = "nouveau";
      durationMinutes = validated.RDV?.duree_minutes || 90;
    }

    const rdvData = {
      user_id,
      client_id: clientId,
      date_heure: dateHeure,
      duree_minutes: durationMinutes,
      adresse: validated.ADRESSE?.adresse || null,
      type_projet: typeProjet,
      type_rdv: typeRdv,
      status: rdvStatus,
      commentaire: fullCommentaire?.slice(0, 5000) || null,
      source: "gmail",
      regie_id: regie_id || null,
      metadata: {
        ai_extracted: true,
        extraction_date: new Date().toISOString(),
        email_intent: intent,
        is_duplicate_client: isDuplicateClient,
        ...(hasMissingMandatoryFields ? { missing_fields: missingFields, needs_completion: true } : {}),
        ...(validated.PROJET ? {
          type_chauffage: validated.PROJET.type_chauffage,
          type_toiture: validated.PROJET.type_toiture,
          orientation_toiture: validated.PROJET.orientation_toiture,
          facture_energie: validated.PROJET.facture_energie,
          motivation: validated.PROJET.motivation,
          budget_estime: validated.PROJET.budget_estime,
          urgence: validated.PROJET.urgence,
        } : {}),
      },
    };

    const { data: newRdv, error: rdvError } = await supabase
      .from("rdv")
      .insert(rdvData)
      .select("id")
      .single();

    if (rdvError) {
      console.error("Error creating RDV:", rdvError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create RDV" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created RDV (type=${typeRdv}): ${newRdv.id}`);

    // ── AUTO-SET date_installation_prevue ON VENTE ─────────────────────────────
    // When an installation email is received, update the vente with the planned date
    if (intent === "installation" && validated.RDV?.date) {
      const { data: venteForClient } = await supabase
        .from("ventes")
        .select("id")
        .eq("client_id", clientId)
        .eq("user_id", user_id)
        .not("status", "in", '("annule","paye")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (venteForClient) {
        await supabase
          .from("ventes")
          .update({
            date_installation_prevue: validated.RDV.date,
            heure_installation_prevue: validated.RDV.heure || "08:00",
          })
          .eq("id", venteForClient.id);
        console.log(`Updated vente ${venteForClient.id} with installation date ${validated.RDV.date}`);
      }
    }

    // ── CLEAR RECONFIRMATION FLAG ─────────────────────────────────────────────
    // When a new email arrives for this client, clear needs_reconfirmation on existing RDVs
    await supabase
      .from("rdv")
      .update({ needs_reconfirmation: false })
      .eq("client_id", clientId)
      .eq("user_id", user_id)
      .eq("needs_reconfirmation", true)
      .neq("id", newRdv.id);

    // ── GEOCODING ─────────────────────────────────────────────────────────────
    let geocodeInfo: { approximate?: boolean; corrected?: boolean } = {};
    if (validated.ADRESSE?.adresse || (validated.ADRESSE?.ville && validated.ADRESSE?.code_postal)) {
      try {
        const fullAddress = [
          validated.ADRESSE?.adresse,
          validated.ADRESSE?.code_postal,
          validated.ADRESSE?.ville,
        ].filter(Boolean).join(" ");

        const geocodeResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/geocode-address`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              address: fullAddress,
              city: validated.ADRESSE?.ville,
              postal_code: validated.ADRESSE?.code_postal,
            }),
          }
        );

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          geocodeInfo = { approximate: geocodeData.approximate, corrected: geocodeData.corrected };

          await supabase.from("clients").update({
            latitude: geocodeData.latitude,
            longitude: geocodeData.longitude,
          }).eq("id", clientId);

          await supabase.from("rdv").update({
            latitude: geocodeData.latitude,
            longitude: geocodeData.longitude,
            metadata: {
              ...rdvData.metadata,
              geocode_approximate: geocodeData.approximate,
              geocode_formatted_address: geocodeData.formatted_address,
            },
          }).eq("id", newRdv.id);
        }
      } catch (geocodeError) {
        console.error("[Geocode] Error:", geocodeError);
      }
    }

    // ── HISTORIQUE ────────────────────────────────────────────────────────────
    const intentLabel = intent === "installation" ? "installation" : intent === "report" ? "reporté/remplacement" : "importé";
    await supabase.from("historique_actions").insert({
      user_id,
      client_id: clientId,
      action_type: "rdv_import",
      description: `RDV ${intentLabel} depuis ${sender_email?.slice(0, 100) || "email"}${regie_id ? " (régie auto-attribuée)" : ""}${hasMissingMandatoryFields ? ` ⚠️ Données manquantes: ${missingFields.join(", ")}` : ""}`,
    });

    // ── NOTIFICATION IF MISSING MANDATORY FIELDS ─────────────────────────────
    if (hasMissingMandatoryFields) {
      const clientName = `${validated.CONTACT.prenom || ""} ${validated.CONTACT.nom}`.trim();
      const missingLabels: string[] = [];
      if (missingFields.includes("prenom")) missingLabels.push("prénom");
      if (missingFields.includes("adresse")) missingLabels.push("adresse");
      if (missingFields.includes("code_postal")) missingLabels.push("code postal");
      if (missingFields.includes("ville")) missingLabels.push("ville");

      const notifTitle = `⚠️ RDV incomplet – ${clientName}`;
      const notifMessage = `Le RDV importé pour ${clientName} est incomplet. Données manquantes : ${missingLabels.join(", ")}. Veuillez compléter la fiche client pour assurer le bon déroulement du rendez-vous.`;

      await supabase.from("notifications").insert({
        user_id,
        titre: notifTitle.slice(0, 255),
        message: notifMessage.slice(0, 1000),
        type: "rdv_rappel",
        client_id: clientId,
        rdv_id: newRdv.id,
      });

      console.log(`Created notification for missing fields: ${missingFields.join(", ")} for client ${clientName}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        client_id: clientId,
        rdv_id: newRdv.id,
        regie_id: regie_id || null,
        intent,
        type_rdv: typeRdv,
        geocoded: !!geocodeInfo.corrected || !!geocodeInfo.approximate,
        geocode_approximate: geocodeInfo.approximate || false,
        missing_fields: hasMissingMandatoryFields ? missingFields : [],
        needs_completion: hasMissingMandatoryFields,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
