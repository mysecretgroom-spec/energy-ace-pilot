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

// Zod schemas for input validation
const ContactSchema = z.object({
  nom: z.string().min(1).max(100).regex(/^[\p{L}\s\-'.]+$/u, "Invalid name format"),
  prenom: z.string().max(100).regex(/^[\p{L}\s\-'.]*$/u, "Invalid first name format").optional(),
  telephone: z.string().optional(),
  telephone_secondaire: z.string().optional(),
  email: z.string().email().max(255).optional().or(z.literal('')).transform(v => v || undefined),
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
  const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de données de leads pour des entreprises de panneaux solaires.
Extrait les informations du mail en JSON structuré.

IMPORTANT: Retourne UNIQUEMENT le JSON, sans commentaires ni texte additionnel.

ATTENTION - INVERSION NOM/PRÉNOM:
Certains emails (notamment Groupe Vent Vert) ont les champs inversés dans leur template :
- "Nom:" contient en fait le PRÉNOM (ex: "Nom: Sandrine")
- "Prénom:" contient en fait le NOM DE FAMILLE (ex: "Prénom: Vincent")
Détecte cette inversion et corrige-la ! Le nom de famille est généralement plus court et typiquement français (Dupont, Martin, Vincent...).
En cas de doute, mets la valeur la plus susceptible d'être un nom de famille dans "nom".

Structure attendue:
{
  "CONTACT": {
    "nom": "NOM DE FAMILLE (obligatoire) - PAS le prénom !",
    "prenom": "Prénom si disponible",
    "telephone": "Téléphone principal (format français)",
    "telephone_secondaire": "Second téléphone si disponible",
    "email": "Email du contact"
  },
  "ADRESSE": {
    "adresse": "Numéro et rue",
    "code_postal": "Code postal 5 chiffres",
    "ville": "Ville"
  },
  "RDV": {
    "date": "Date au format YYYY-MM-DD",
    "heure": "Heure au format HH:MM",
    "duree_minutes": 90,
    "type_projet": "photovoltaique|pompe_chaleur|renovation|autre",
    "commentaire": "Notes importantes"
  },
  "PROJET": {
    "type_chauffage": "electrique|gaz|fioul|bois|autre",
    "type_toiture": "tuiles|ardoises|bac_acier|autre",
    "orientation_toiture": "sud|sud-est|sud-ouest|est|ouest|autre",
    "facture_energie": 0,
    "motivation": "Raison du projet",
    "budget_estime": 0,
    "urgence": "imminent|court_terme|moyen_terme|informatif"
  }
}

Règles:
- Le nom DE FAMILLE est OBLIGATOIRE, met "INCONNU" si vraiment absent
- VÉRIFIE toujours l'inversion Nom/Prénom dans les emails de régies
- Formate les téléphones en 10 chiffres français (ex: 0612345678)
- Normalise les dates en YYYY-MM-DD
- Si une info n'est pas trouvée, omet le champ (ne met pas null)`;

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
    let dateHeure: string | null = null;
    if (validated.RDV?.date) {
      const date = validated.RDV.date;
      const time = validated.RDV.heure || "09:00";
      
      // Validate the date is not too far in the past or future
      const parsedDate = new Date(`${date}T${time}:00`);
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const oneYearAhead = new Date(now);
      oneYearAhead.setFullYear(now.getFullYear() + 1);
      
      if (parsedDate >= oneYearAgo && parsedDate <= oneYearAhead) {
        dateHeure = `${date}T${time}:00`;
      }
    }
    
    if (!dateHeure) {
      // Default to tomorrow at 9:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      dateHeure = tomorrow.toISOString();
    }

    // Create RDV with regie_id
    const rdvData = {
      user_id,
      client_id: clientId,
      date_heure: dateHeure,
      duree_minutes: validated.RDV?.duree_minutes || 90,
      adresse: validated.ADRESSE?.adresse || null,
      type_projet: validated.RDV?.type_projet || "solaire",
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

    // Log action in historique
    await supabase.from("historique_actions").insert({
      user_id,
      client_id: clientId,
      action_type: "rdv_import",
      description: `RDV importé depuis ${sender_email?.slice(0, 100) || "email"}${regie_id ? " (régie auto-attribuée)" : ""}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        client_id: clientId,
        rdv_id: newRdv.id,
        regie_id: regie_id || null,
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
