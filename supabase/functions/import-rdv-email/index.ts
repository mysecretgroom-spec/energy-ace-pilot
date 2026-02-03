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

// Zod schemas for input validation - more tolerant for AI extraction
const ContactSchema = z.object({
  nom: z.string().min(1).max(100).transform(v => v.replace(/[^\p{L}\s\-'.]/gu, "").trim()),
  prenom: z.string().max(100).optional().transform(v => v?.replace(/[^\p{L}\s\-'.]/gu, "").trim() || undefined),
  telephone: z.string().optional(),
  telephone_secondaire: z.string().optional(),
  // More tolerant email validation - accept empty, omit invalid
  email: z.string().optional().transform(v => {
    if (!v || v.trim() === '') return undefined;
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(v) ? v.toLowerCase() : undefined;
  }),
});

const AdresseSchema = z.object({
  adresse: z.string().max(500).optional(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Invalid postal code").optional().or(z.literal('')).transform(v => v || undefined),
  ville: z.string().max(100).optional(),
});

const RdvSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  heure: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  duree_minutes: z.number().min(15).max(480).optional(),
  type_projet: z.string().max(50).optional(),
  commentaire: z.string().max(2000).optional(),
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

async function extractLeadWithAI(emailBody: string, subject: string): Promise<ExtractedLead | null> {
  const systemPrompt = `Tu es un expert en extraction de données structurées depuis des emails de leads pour entreprises d'énergie renouvelable (panneaux solaires, PAC, isolation).

MISSION: Analyse cet email de régie/agence et extrait TOUTES les informations en JSON.

## FORMATS D'EMAIL COURANTS À RECONNAÎTRE:

### Format 1 - Clé:Valeur (le plus courant)
\`\`\`
Nom:Bernier
Prénom:Eric
Adresse:25 RUE DES 3 FLEURS
Code postal:28150
Ville:MOUTIERS
Date du RDV:29/01/2026
Heure du RDV:10:00
\`\`\`

### Format 2 - Tableau HTML (après conversion texte)
\`\`\`
Statut call RDV Confirmé Nom Bernier Prénom Eric ...
\`\`\`

### Format 3 - Email narratif
\`\`\`
Bonjour, nouveau RDV pour M. Bernier Eric au 25 rue des 3 fleurs...
\`\`\`

## RÈGLES D'EXTRACTION CRITIQUES:

1. **DATES** - Convertis TOUS les formats en YYYY-MM-DD:
   - "29/01/2026" → "2026-01-29"
   - "29 janvier 2026" → "2026-01-29"
   - "29-01-2026" → "2026-01-29"

2. **HEURES** - Convertis en HH:MM:
   - "10:00" → "10:00"
   - "10h00" → "10:00"
   - "10h" → "10:00"

3. **TÉLÉPHONES** - Extrait les 10 chiffres français:
   - "06 12 34 56 78" → "0612345678"
   - "+33612345678" → "0612345678"

4. **INVERSION NOM/PRÉNOM** - ATTENTION aux templates mal configurés:
   - Si "Nom:" contient un prénom typique (Jean, Marie, Eric) et "Prénom:" un nom de famille → INVERSE
   - Le nom de famille est souvent en majuscules ou plus court

5. **TYPE DE PROJET** - Utilise UNIQUEMENT ces valeurs:
   - "photovoltaique" (pour solaire, PV, panneaux)
   - "pompe_chaleur" (pour PAC, chauffage, pompe)
   - "isolation" (pour ITE, isolation)
   - "ballon_thermo" (pour ECS, ballon, chauffe-eau)
   - "autre" (si aucun match)

6. **EMAIL** - Si absent ou invalide, NE METS PAS le champ du tout (pas de valeur vide, pas "INCONNU", pas null)

7. **COMMENTAIRES** - Inclus les infos importantes du contexte:
   - Historique client (déjà reçu des devis, mauvaise expérience...)
   - Instructions spéciales
   - Motivation/hésitations

8. **RÈGLE ABSOLUE - JAMAIS "INCONNU"**:
   - Si une info n'est pas dans l'email, NE METS PAS le champ
   - NE JAMAIS mettre "INCONNU", "N/A", "null", "" ou des valeurs vides
   - Omets simplement le champ s'il n'y a pas de donnée

9. **ADRESSE - EXTRACTION DÉTAILLÉE** (TRÈS IMPORTANT):
   - Sépare TOUJOURS les composants de l'adresse:
     - "adresse": Le numéro et nom de rue (ex: "25 RUE DES 3 FLEURS")
     - "code_postal": Exactement 5 chiffres (ex: "28150")
     - "ville": Le nom de la ville en majuscules (ex: "MOUTIERS")
   - Si l'adresse est sur une seule ligne comme "25 rue des fleurs 28150 MOUTIERS":
     - Extrait le code postal (5 chiffres)
     - La partie après le code postal = ville
     - La partie avant le code postal = adresse
   - Si l'adresse contient des abréviations: RUE, AV (Avenue), BD (Boulevard), IMPASSE, ALLÉE, PL (Place)
   - Gère les noms composés: "SAINT-MARTIN", "VILLENEUVE-D'ASCQ"
   - Le code postal doit TOUJOURS être 5 chiffres exactement

## STRUCTURE JSON ATTENDUE:

{
  "CONTACT": {
    "nom": "BERNIER",
    "prenom": "Eric",
    "telephone": "0612345678"
  },
  "ADRESSE": {
    "adresse": "25 RUE DES 3 FLEURS",
    "code_postal": "28150",
    "ville": "MOUTIERS"
  },
  "RDV": {
    "date": "2026-01-29",
    "heure": "10:00",
    "duree_minutes": 90,
    "type_projet": "photovoltaique",
    "commentaire": "A déjà reçu 3 devis entre 25k-30k pour 6kWc. Mauvaise expérience PAC. Faire étude technique approfondie."
  },
  "PROJET": {
    "type_chauffage": "bois",
    "facture_energie": 130
  }
}

IMPORTANT: Si un champ n'a pas de valeur trouvée, NE L'INCLUS PAS dans le JSON. Pas de "INCONNU" !

RETOURNE UNIQUEMENT LE JSON, sans markdown ni commentaires.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Sujet: ${subject}\n\nContenu:\n${emailBody}` }
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
    
    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    // Clean up and parse
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
  
  // Remove all non-digits
  let digits = phone.replace(/\D/g, "");
  
  // Handle French country code
  if (digits.startsWith("33") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  if (digits.startsWith("0033")) {
    digits = "0" + digits.slice(4);
  }
  
  // Must be 10 digits for French phone
  if (digits.length !== 10) return null;
  if (!digits.startsWith("0")) return null;
  
  return digits;
}

// Validate and sanitize extracted lead data
function validateLeadData(extracted: ExtractedLead): ValidatedLead | null {
  try {
    // Prepare data for validation
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
    
    const validated = ExtractedLeadSchema.parse(dataToValidate);
    return validated;
  } catch (validationError) {
    console.error("Validation error:", validationError);
    
    // Try to salvage basic data if possible
    if (extracted.CONTACT?.nom) {
      try {
        // Minimal validation - just the name
        const minimalData = {
          CONTACT: {
            nom: extracted.CONTACT.nom.slice(0, 100).replace(/[^\p{L}\s\-'.]/gu, ""),
          },
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_email, subject, body, user_id, regie_id } = await req.json();
    
    // Validate required fields
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

    // Validate UUID format for user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid user_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate regie_id if provided
    if (regie_id && !uuidRegex.test(regie_id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid regie_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing email from ${sender_email}: ${subject}`);
    console.log(`Regie ID: ${regie_id}`);

    // Extract lead data using AI
    const extracted = await extractLeadWithAI(body, subject);
    
    if (!extracted || !extracted.CONTACT?.nom) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract lead data (nom manquant)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize extracted data
    const validated = validateLeadData(extracted);
    if (!validated) {
      return new Response(
        JSON.stringify({ success: false, error: "Data validation failed - invalid format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize phone numbers (with additional validation)
    const phone1 = normalizePhone(validated.CONTACT.telephone);
    const phone2 = normalizePhone(validated.CONTACT.telephone_secondaire);
    const email = validated.CONTACT.email?.toLowerCase();

    // Deduplication: check if client already exists
    let existingClient = null;
    
    // Try to find by phone first
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
    
    // Try by email if not found
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
    
    // Try by name + address as last resort
    if (!existingClient && validated.CONTACT.nom && validated.ADRESSE?.code_postal) {
      const { data } = await supabase
        .from("clients")
        .select("id, nom")
        .eq("user_id", user_id)
        .ilike("nom", validated.CONTACT.nom)
        .eq("code_postal", validated.ADRESSE.code_postal)
        .limit(1)
        .maybeSingle();
      existingClient = data;
    }

    let clientId: string;
    let action: "created" | "updated" = "created";

    if (existingClient) {
      clientId = existingClient.id;
      action = "updated";
      console.log(`Found existing client: ${existingClient.nom} (${clientId})`);
      
      // Update client with any new info
      const updateData: Record<string, unknown> = {};
      if (!existingClient.nom && validated.CONTACT.prenom) {
        updateData.prenom = validated.CONTACT.prenom;
      }
      if (phone2) updateData.telephone_secondaire = phone2;
      if (email) updateData.email = email;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from("clients").update(updateData).eq("id", clientId);
      }
    } else {
      // Create new client with validated data
      const clientData = {
        user_id,
        nom: validated.CONTACT.nom.toUpperCase(),
        prenom: validated.CONTACT.prenom || null,
        telephone: phone1,
        telephone_secondaire: phone2,
        email: email,
        adresse: validated.ADRESSE?.adresse || null,
        code_postal: validated.ADRESSE?.code_postal || null,
        ville: validated.ADRESSE?.ville || null,
        source: sender_email?.slice(0, 255) || null,
        metadata: validated.PROJET ? {
          type_chauffage: validated.PROJET.type_chauffage,
          type_toiture: validated.PROJET.type_toiture,
          orientation_toiture: validated.PROJET.orientation_toiture,
          facture_energie: validated.PROJET.facture_energie,
          projet_motivation: validated.PROJET.motivation,
          budget_estime: validated.PROJET.budget_estime,
          urgence: validated.PROJET.urgence,
        } : null,
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

    // Parse RDV date/time with validation
    // IMPORTANT: Emails contain French local time, so we need to store with Europe/Paris timezone
    let dateHeure: string | null = null;
    if (validated.RDV?.date) {
      const date = validated.RDV.date;
      const time = validated.RDV.heure || "09:00";
      
      // Validate the date is not too far in the past or future
      // Parse as Europe/Paris timezone (where the RDV actually takes place)
      const parsedDate = new Date(`${date}T${time}:00+01:00`); // CET offset for validation
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const oneYearAhead = new Date(now);
      oneYearAhead.setFullYear(now.getFullYear() + 1);
      
      if (parsedDate >= oneYearAgo && parsedDate <= oneYearAhead) {
        // Determine if date falls in DST (summer time) for France
        // DST in France: last Sunday of March to last Sunday of October
        const month = parseInt(date.split('-')[1], 10);
        const day = parseInt(date.split('-')[2], 10);
        const year = parseInt(date.split('-')[0], 10);
        
        // Simple DST check for France (approximate)
        // March 25 - October 31 is roughly summer time
        const isSummerTime = (month > 3 && month < 10) || 
          (month === 3 && day >= 25) || 
          (month === 10 && day <= 27);
        
        const offset = isSummerTime ? "+02:00" : "+01:00";
        dateHeure = `${date}T${time}:00${offset}`;
      }
    }
    
    if (!dateHeure) {
      // Default to tomorrow at 9:00 Paris time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      // Use CET offset for default
      dateHeure = `${year}-${month}-${day}T09:00:00+01:00`;
    }

    // Create RDV with regie_id
    // Map type_projet to valid enum values
    const validProjectTypes = ["photovoltaique", "pompe_chaleur", "isolation", "ballon_thermo", "autre"];
    let typeProjet = validated.RDV?.type_projet?.toLowerCase() || "photovoltaique";
    
    // Map common variations to valid enum values
    if (typeProjet.includes("solaire") || typeProjet.includes("pv") || typeProjet.includes("panneau")) {
      typeProjet = "photovoltaique";
    } else if (typeProjet.includes("pac") || typeProjet.includes("chaleur") || typeProjet.includes("pompe")) {
      typeProjet = "pompe_chaleur";
    } else if (typeProjet.includes("isol") || typeProjet.includes("ite")) {
      typeProjet = "isolation";
    } else if (typeProjet.includes("ballon") || typeProjet.includes("thermo") || typeProjet.includes("ecs")) {
      typeProjet = "ballon_thermo";
    } else if (!validProjectTypes.includes(typeProjet)) {
      typeProjet = "photovoltaique"; // Default to photovoltaique
    }
    
    const rdvData = {
      user_id,
      client_id: clientId,
      date_heure: dateHeure,
      duree_minutes: validated.RDV?.duree_minutes || 90,
      adresse: validated.ADRESSE?.adresse || null,
      type_projet: typeProjet,
      status: "nouveau",
      commentaire: validated.RDV?.commentaire?.slice(0, 2000) || null,
      source: "gmail",
      regie_id: regie_id || null,
      metadata: validated.PROJET ? {
        ai_extracted: true,
        extraction_date: new Date().toISOString(),
        type_chauffage: validated.PROJET.type_chauffage,
        type_toiture: validated.PROJET.type_toiture,
        orientation_toiture: validated.PROJET.orientation_toiture,
        facture_energie: validated.PROJET.facture_energie,
        motivation: validated.PROJET.motivation,
        budget_estime: validated.PROJET.budget_estime,
        urgence: validated.PROJET.urgence,
      } : { ai_extracted: true, extraction_date: new Date().toISOString() },
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

    console.log(`Created RDV: ${newRdv.id} with regie_id: ${regie_id}`);

    // Geocode address automatically if we have address components
    let geocodeInfo: { approximate?: boolean; corrected?: boolean } = {};
    if (validated.ADRESSE?.adresse || (validated.ADRESSE?.ville && validated.ADRESSE?.code_postal)) {
      try {
        const fullAddress = [
          validated.ADRESSE?.adresse,
          validated.ADRESSE?.code_postal,
          validated.ADRESSE?.ville
        ].filter(Boolean).join(" ");

        console.log(`[Geocode] Auto-geocoding address: "${fullAddress}"`);
        
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
          console.log(`[Geocode] Result: lat=${geocodeData.latitude}, lon=${geocodeData.longitude}, approximate=${geocodeData.approximate}`);
          
          geocodeInfo = {
            approximate: geocodeData.approximate || false,
            corrected: geocodeData.corrected || false,
          };

          // Update client with coordinates
          await supabase.from("clients").update({
            latitude: geocodeData.latitude,
            longitude: geocodeData.longitude,
          }).eq("id", clientId);

          // Update RDV with coordinates
          await supabase.from("rdv").update({
            latitude: geocodeData.latitude,
            longitude: geocodeData.longitude,
            metadata: {
              ...rdvData.metadata,
              geocode_approximate: geocodeData.approximate,
              geocode_formatted_address: geocodeData.formatted_address,
            },
          }).eq("id", newRdv.id);

          console.log(`[Geocode] Updated client and RDV with coordinates`);
        } else {
          console.log(`[Geocode] Failed to geocode address`);
        }
      } catch (geocodeError) {
        console.error("[Geocode] Error during geocoding:", geocodeError);
        // Continue without geocoding - it's not critical
      }
    }

    // Log action in historique
    await supabase.from("historique_actions").insert({
      user_id,
      client_id: clientId,
      action_type: "rdv_import",
      description: `RDV importé depuis ${sender_email?.slice(0, 100) || "email"}${regie_id ? " (régie auto-attribuée)" : ""}${geocodeInfo.approximate ? " (géoloc. approx.)" : ""}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        client_id: clientId,
        rdv_id: newRdv.id,
        regie_id: regie_id || null,
        geocoded: !!geocodeInfo.corrected || !!geocodeInfo.approximate,
        geocode_approximate: geocodeInfo.approximate || false,
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
